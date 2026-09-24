import {
    assertOfficialUsdtContract,
    ensureBscNetwork,
    getWrongNetworkMessage,
    getActiveChainId,
    isTestnetMode,
    parseTokenAmount,
    sendContractTx,
    waitForConfirmations,
} from '@/lib/web3Deposit';
import { formatTokenWei, friendlySwapError } from '@/lib/web3PancakeSwap';

/**
 * RaceICO mint-to-stake helpers.
 * purchase(usdtAmount, lockPeriod) → USDT to admin, RACE mint to engine, openIcoStake.
 * Selectors verified against contracts/src/RaceICO.sol (Hardhat id()).
 */
const SELECTORS = {
    approve: '0x095ea7b3',
    allowance: '0xdd62ed3e',
    balanceOf: '0x70a08231',
    purchase: '0x70876c98', // purchase(uint256,uint256)
    getCurrentPhase: '0xa3a40ea5',
    getPhase: '0xf12479ac',
    getUserAllocation: '0xb920ade2',
    getPurchase: '0x3742a9f7',
    getUserPurchaseIds: '0x2927ae6e',
    quoteRaceOut: '0x4d0e1b3c',
    icoCompleted: '0x204e8b17',
    totalICOSold: '0x4b76496f',
    adminWallet: '0x36b19cd7',
};

export const ICO_STAKE_PLANS = [
    {
        id: '180',
        lockPeriodSeconds: 180 * 86400,
        label: '180 Days',
        dailyRoiPercent: '0.50',
        lockLabel: 'Locked 180 days',
    },
    {
        id: '365',
        lockPeriodSeconds: 365 * 86400,
        label: '365 Days',
        dailyRoiPercent: '0.70',
        lockLabel: 'Locked 365 days',
    },
    {
        id: '730',
        lockPeriodSeconds: 730 * 86400,
        label: '730 Days',
        dailyRoiPercent: '0.90',
        lockLabel: 'Locked 730 days',
    },
    {
        id: '1095',
        lockPeriodSeconds: 1095 * 86400,
        label: '1095 Days',
        dailyRoiPercent: '1.00',
        lockLabel: 'Locked 1095 days',
    },
];

/** Post-ICO normal staking (Engine.participate) — includes Flexible. */
export const POST_ICO_STAKE_PLANS = [
    {
        id: 'flexible',
        lockPeriodSeconds: 0,
        days: 0,
        label: 'Flexible',
        dailyRoiPercent: '0.35',
        lockLabel: 'No fixed lock — withdraw anytime',
    },
    ...ICO_STAKE_PLANS.map((p) => ({
        ...p,
        days: Number(p.id),
    })),
];

function padAddress(address) {
    return address.slice(2).toLowerCase().padStart(64, '0');
}

function padUint256(value) {
    return BigInt(value).toString(16).padStart(64, '0');
}

function padUint8(value) {
    return BigInt(value).toString(16).padStart(64, '0');
}

async function ethCall({ to, data, rpcUrl }) {
    if (typeof window !== 'undefined' && window.ethereum) {
        try {
            const result = await window.ethereum.request({
                method: 'eth_call',
                params: [{ to, data }, 'latest'],
            });
            return result || '0x0';
        } catch {
            // fall through to RPC
        }
    }
    if (!rpcUrl) return '0x0';
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_call',
            params: [{ to, data }, 'latest'],
        }),
    });
    const payload = await response.json();
    return payload?.result || '0x0';
}

function word(hex, index) {
    const raw = (hex || '0x').replace(/^0x/, '');
    const slice = raw.slice(index * 64, (index + 1) * 64);
    return BigInt(`0x${slice || '0'}`);
}

function decodePhase(hex) {
    return {
        priceUsdt: word(hex, 0),
        allocation: word(hex, 1),
        sold: word(hex, 2),
        remaining: word(hex, 3),
        raisedUsdt: word(hex, 4),
        started: word(hex, 5) === 1n,
        completed: word(hex, 6) === 1n,
        startedAt: Number(word(hex, 7)),
        completedAt: Number(word(hex, 8)),
    };
}

function decodePurchase(hex) {
    const raw = (hex || '0x').replace(/^0x/, '');
    return {
        buyer: `0x${raw.slice(24, 64)}`,
        phaseId: Number(word(hex, 1)),
        raceAmount: word(hex, 2),
        usdtPaid: word(hex, 3),
        priceUsdt: word(hex, 4),
        purchasedAt: Number(word(hex, 5)),
        unlockAt: Number(word(hex, 6)),
        claimed: word(hex, 7),
        claimable: false,
    };
}

function decodeUintArray(hex) {
    const raw = (hex || '0x').replace(/^0x/, '');
    if (raw.length < 128) return [];
    const offset = Number(BigInt(`0x${raw.slice(0, 64)}`)) * 2;
    const length = Number(BigInt(`0x${raw.slice(offset, offset + 64)}`));
    const out = [];
    for (let i = 0; i < length; i++) {
        const start = offset + 64 + i * 64;
        out.push(Number(BigInt(`0x${raw.slice(start, start + 64)}`)));
    }
    return out;
}

export { formatTokenWei, friendlySwapError };

export function friendlyIcoError(err) {
    const msg = String(err?.shortMessage || err?.reason || err?.message || err || '');
    const lower = msg.toLowerCase();
    if (err?.code === 4001 || lower.includes('user rejected') || lower.includes('user denied')) {
        return 'Transaction rejected in wallet.';
    }
    if (lower.includes('insufficient funds') || lower.includes('insufficient balance')) {
        return 'Insufficient USDT or BNB for gas.';
    }
    if (lower.includes('allowance') || lower.includes('transfer amount exceeds allowance')) {
        return 'USDT allowance too low. Approve USDT first.';
    }
    if (lower.includes('phase sold out') || lower.includes('phase usdt cap')) {
        return 'This ICO phase is sold out or over the USDT cap.';
    }
    if (lower.includes('total sold out') || lower.includes('completed')) {
        return 'ICO allocation is complete.';
    }
    if (lower.includes('no active phase') || lower.includes('phase inactive')) {
        return 'No active ICO phase. Wait for the next phase to start.';
    }
    if (lower.includes('paused') || lower.includes('enforcedpause')) {
        return 'ICO is paused.';
    }
    if (
        lower.includes('wrong network')
        || lower.includes('switch metamask')
        || lower.includes('chain id 97')
        || lower.includes('chain id 56')
        || lower.includes('bsc testnet')
    ) {
        const label = isTestnetMode() || getActiveChainId() === 97 ? 'BSC Testnet (Chain ID 97)' : 'BNB Smart Chain (Chain ID 56)';
        return `Wrong network. Switch to ${label}. ${getWrongNetworkMessage()}`;
    }
    return friendlySwapError(err) || msg || 'ICO transaction failed.';
}

export async function readIcoAdminWallet({ icoContract, rpcUrl }) {
    if (!icoContract) return '';
    const hex = await ethCall({ to: icoContract, data: SELECTORS.adminWallet, rpcUrl });
    if (!hex || hex === '0x' || hex === '0x0') return '';
    return `0x${hex.replace(/^0x/, '').slice(-40)}`;
}

export async function readIcoCurrentPhase({ icoContract, rpcUrl }) {
    if (!icoContract) return 0;
    return Number(BigInt(await ethCall({ to: icoContract, data: SELECTORS.getCurrentPhase, rpcUrl })));
}

export async function readIcoCompleted({ icoContract, rpcUrl }) {
    if (!icoContract) return false;
    return BigInt(await ethCall({ to: icoContract, data: SELECTORS.icoCompleted, rpcUrl })) === 1n;
}

export async function readTotalIcoSold({ icoContract, rpcUrl }) {
    if (!icoContract) return 0n;
    return BigInt(await ethCall({ to: icoContract, data: SELECTORS.totalICOSold, rpcUrl }));
}

export async function readIcoPhase({ icoContract, phaseId, rpcUrl }) {
    const data = SELECTORS.getPhase + padUint8(phaseId);
    return decodePhase(await ethCall({ to: icoContract, data, rpcUrl }));
}

export async function readAllIcoPhases({ icoContract, rpcUrl }) {
    const phases = [];
    for (let id = 1; id <= 3; id++) {
        phases.push({ id, ...(await readIcoPhase({ icoContract, phaseId: id, rpcUrl })) });
    }
    return phases;
}

export async function quoteIcoRaceOut({ icoContract, phaseId, usdtAmount, rpcUrl }) {
    const amountWei = parseTokenAmount(usdtAmount, 18);
    const data = SELECTORS.quoteRaceOut + padUint8(phaseId) + padUint256(amountWei);
    return BigInt(await ethCall({ to: icoContract, data, rpcUrl }));
}

export async function readErc20Allowance({ token, owner, spender, rpcUrl }) {
    if (!token || !owner || !spender) return 0n;
    const data = SELECTORS.allowance + padAddress(owner) + padAddress(spender);
    return BigInt(await ethCall({ to: token, data, rpcUrl }));
}

export async function readErc20BalanceOf({ token, wallet, rpcUrl }) {
    if (!token || !wallet) return 0n;
    const data = SELECTORS.balanceOf + padAddress(wallet);
    return BigInt(await ethCall({ to: token, data, rpcUrl }));
}

export async function readUserIcoAllocation({ icoContract, wallet, rpcUrl }) {
    if (!wallet || !icoContract) {
        return { raceTotal: 0n, raceClaimed: 0n, raceLocked: 0n, usdtPaid: 0n };
    }
    const data = SELECTORS.getUserAllocation + padAddress(wallet);
    const hex = await ethCall({ to: icoContract, data, rpcUrl });
    return {
        raceTotal: word(hex, 0),
        raceClaimed: word(hex, 1),
        raceLocked: word(hex, 2),
        usdtPaid: word(hex, 3),
    };
}

export async function readUserIcoPurchases({ icoContract, wallet, rpcUrl }) {
    if (!wallet || !icoContract) return [];
    const idsHex = await ethCall({
        to: icoContract,
        data: SELECTORS.getUserPurchaseIds + padAddress(wallet),
        rpcUrl,
    });
    const ids = decodeUintArray(idsHex);
    const purchases = [];
    for (const id of ids) {
        const hex = await ethCall({
            to: icoContract,
            data: SELECTORS.getPurchase + padUint256(id),
            rpcUrl,
        });
        purchases.push({ id, ...decodePurchase(hex) });
    }
    return purchases;
}

export async function approveUsdtForIco({
    walletAddress,
    icoContract,
    usdtContract,
    amountUsd,
    waitConfirmations = 1,
}) {
    assertOfficialUsdtContract(usdtContract);
    await ensureBscNetwork();
    const amountWei = parseTokenAmount(amountUsd, 18);
    const txHash = await sendContractTx({
        from: walletAddress,
        to: usdtContract,
        data: SELECTORS.approve + padAddress(icoContract) + padUint256(amountWei),
    });
    if (waitConfirmations > 0) {
        await waitForConfirmations(txHash, { minConfirmations: waitConfirmations });
    }
    return txHash;
}

/**
 * Call RaceICO.purchase(usdtAmount) only — does NOT approve.
 * Mint-to-user: RACE goes to buyer wallet; USDT to admin.
 */
export async function purchaseIcoRace({
    walletAddress,
    icoContract,
    usdtContract,
    amountUsd,
    lockPeriodSeconds,
    waitConfirmations = 3,
}) {
    assertOfficialUsdtContract(usdtContract);
    await ensureBscNetwork();

    const amountWei = parseTokenAmount(amountUsd, 18);
    const lock = BigInt(lockPeriodSeconds ?? 0);
    const allowance = await readErc20Allowance({
        token: usdtContract,
        owner: walletAddress,
        spender: icoContract,
    });
    if (allowance < amountWei) {
        throw new Error('USDT allowance too low. Approve USDT first.');
    }

    const txHash = await sendContractTx({
        from: walletAddress,
        to: icoContract,
        data: SELECTORS.purchase + padUint256(amountWei) + padUint256(lock),
    });

    if (waitConfirmations > 0) {
        await waitForConfirmations(txHash, { minConfirmations: waitConfirmations });
    }

    return txHash;
}

export function formatUsdPriceFromWei(priceWei, usdtDecimals = 18) {
    return formatTokenWei(priceWei, usdtDecimals, 4);
}

export function formatPurchaseDate(unixSeconds) {
    if (!unixSeconds) return '—';
    return new Date(unixSeconds * 1000).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
