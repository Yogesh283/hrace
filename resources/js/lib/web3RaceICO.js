import {
    assertOfficialUsdtContract,
    ensureBscNetwork,
    extractRpcRevertMessage,
    friendlyNetworkSwitchMessage,
    getActiveChainId,
    isLikelyWrongNetworkError,
    parseTokenAmount,
    sendContractTx,
    waitForConfirmations,
} from '@/lib/web3Deposit';
import { formatTokenWei, friendlySwapError } from '@/lib/web3PancakeSwap';
import { getWalletProvider, walletRequest } from '@/lib/web3Wallet';

/**
 * RaceICO hold-then-stake helpers.
 * purchase → USDT to admin, RACE allocated from ICO reserve and held (not wallet, not stake).
 * createStake / createAllStakes → after icoCompleted, open Engine stake at icoEndPrice.
 */
const SELECTORS = {
    approve: '0x095ea7b3',
    allowance: '0xdd62ed3e',
    balanceOf: '0x70a08231',
    purchase: '0x70876c98', // purchase(uint256,uint256)
    createStake: '0x1bf6ddae', // createStake(uint256)
    createAllStakes: '0xbfe83d98', // createAllStakes()
    getCurrentPhase: '0xa3a40ea5',
    getPhase: '0xf12479ac',
    getUserAllocation: '0xb920ade2',
    getPurchase: '0x3742a9f7',
    getUserPurchaseIds: '0x2927ae6e',
    quoteRaceOut: '0x4d0e1b3c',
    icoCompleted: '0x204e8b17',
    totalICOSold: '0x4b76496f',
    adminWallet: '0x36b19cd7',
    userHeldRace: '0xf884e36f',
    pendingStakeCount: '0x0f29b783',
    icoEndPriceUsdt: '0x43548e19',
};

const STAKE_NOT_CREATED = (1n << 256n) - 1n;

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

/** Official Flexible daily ROI (35 bps) — Engine + Laravel reward_plan. */
export const FLEXIBLE_DAILY_ROI_PERCENT = '0.35';

/** Post-ICO normal staking (Engine.participate) — includes Flexible. */
export const POST_ICO_STAKE_PLANS = [
    {
        id: 'flexible',
        lockPeriodSeconds: 0,
        days: 0,
        label: 'Flexible',
        dailyRoiPercent: FLEXIBLE_DAILY_ROI_PERCENT,
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
    return hexToBigInt(value).toString(16).padStart(64, '0');
}

function padUint8(value) {
    return hexToBigInt(value).toString(16).padStart(64, '0');
}

/** Wallet/RPC often returns empty "0x"; BigInt("0x") throws. */
function normalizeEthHex(hex) {
    const n = String(hex ?? '').trim();
    if (!n || n === '0x' || n === '0X') {
        return '0x0';
    }
    return n;
}

function hexToBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
    const n = normalizeEthHex(value);
    try {
        return BigInt(n);
    } catch {
        return 0n;
    }
}

async function ethCall({ to, data, rpcUrl }) {
    if (typeof window !== 'undefined' && getWalletProvider()) {
        try {
            const result = await walletRequest({
                method: 'eth_call',
                params: [{ to, data }, 'latest'],
            });
            return normalizeEthHex(result);
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
    return normalizeEthHex(payload?.result);
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
    const raceAmount = word(hex, 2);
    const claimed = word(hex, 7);
    const lockPeriod = word(hex, 9);
    const stakeIndex = word(hex, 10);
    const staked =
        raceAmount > 0n && claimed === raceAmount && stakeIndex !== STAKE_NOT_CREATED;
    return {
        buyer: `0x${raw.slice(24, 64)}`,
        phaseId: Number(word(hex, 1)),
        raceAmount,
        usdtPaid: word(hex, 3),
        priceUsdt: word(hex, 4),
        purchasedAt: Number(word(hex, 5)),
        unlockAt: Number(word(hex, 6)),
        claimed,
        claimable: false,
        lockPeriod: Number(lockPeriod),
        stakeIndex: staked ? Number(stakeIndex) : null,
        staked,
        status: staked ? 'staked' : 'held',
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
    const nested =
        err?.data?.message ||
        err?.error?.message ||
        err?.info?.error?.message ||
        err?.data?.data?.message ||
        '';
    const encoded =
        typeof err?.data === 'string'
            ? err.data
            : typeof err?.data?.data === 'string'
              ? err.data.data
              : typeof err?.info?.error?.data === 'string'
                ? err.info.error.data
                : '';
    const decoded = decodeSolidityErrorString(encoded);
    const msg = String(
        decoded || nested || err?.shortMessage || err?.reason || err?.message || err || '',
    );
    const lower = msg.toLowerCase();
    if (err?.code === 4001 || lower.includes('user rejected') || lower.includes('user denied')) {
        return 'Transaction rejected in wallet.';
    }
    if (lower.includes('bad plan')) {
        return 'Invalid stake plan. Select 180 / 365 / 730 / 1095 days and try again.';
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
    if (lower.includes('reserve empty')) {
        return 'ICO reserve is not funded yet.';
    }
    if (lower.includes('no active phase') || lower.includes('phase inactive')) {
        return 'No active ICO phase. Wait for the next phase to start.';
    }
    if (lower.includes('paused') || lower.includes('enforcedpause')) {
        return 'ICO is paused.';
    }
    if (
        lower.includes('0x04578698')
        || lower.includes('oraclestale')
        || String(encoded).toLowerCase().includes('0x04578698')
    ) {
        return mapIcoRevertToUserMessage('OracleStale');
    }
    if (lower.includes('execution reverted') && !decoded) {
        const mapped = mapIcoRevertToUserMessage(msg);
        if (mapped) {
            return mapped;
        }
        return msg.includes('ICO buy would fail')
            ? msg
            : 'ICO simulation failed. Stay on BNB Smart Chain, approve USDT, then try again.';
    }
    if (lower.includes('transaction failed on chain')) {
        return msg;
    }
    if (lower.includes('cannot convert 0x') || lower.includes('convert 0x to a bigint')) {
        return 'Could not read ICO from the wallet RPC. Stay on BNB Smart Chain and refresh.';
    }
    if (isLikelyWrongNetworkError(msg)) {
        return friendlyNetworkSwitchMessage(getActiveChainId());
    }
    const swapMsg = friendlySwapError(err);
    if (swapMsg && isLikelyWrongNetworkError(swapMsg)) {
        return friendlyNetworkSwitchMessage(getActiveChainId());
    }
    return swapMsg || msg || 'ICO transaction failed.';
}

export async function readIcoAdminWallet({ icoContract, rpcUrl }) {
    if (!icoContract) return '';
    const hex = await ethCall({ to: icoContract, data: SELECTORS.adminWallet, rpcUrl });
    if (!hex || hex === '0x' || hex === '0x0') return '';
    return `0x${hex.replace(/^0x/, '').slice(-40)}`;
}

export async function readIcoCurrentPhase({ icoContract, rpcUrl }) {
    if (!icoContract) return 0;
    return Number(hexToBigInt(await ethCall({ to: icoContract, data: SELECTORS.getCurrentPhase, rpcUrl })));
}

export async function readIcoCompleted({ icoContract, rpcUrl }) {
    if (!icoContract) return false;
    return hexToBigInt(await ethCall({ to: icoContract, data: SELECTORS.icoCompleted, rpcUrl })) === 1n;
}

export async function readTotalIcoSold({ icoContract, rpcUrl }) {
    if (!icoContract) return 0n;
    return hexToBigInt(await ethCall({ to: icoContract, data: SELECTORS.totalICOSold, rpcUrl }));
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
    return hexToBigInt(await ethCall({ to: icoContract, data, rpcUrl }));
}

export async function readErc20Allowance({ token, owner, spender, rpcUrl }) {
    if (!token || !owner || !spender) return 0n;
    const data = SELECTORS.allowance + padAddress(owner) + padAddress(spender);
    return hexToBigInt(await ethCall({ to: token, data, rpcUrl }));
}

export async function readErc20BalanceOf({ token, wallet, rpcUrl }) {
    if (!token || !wallet) return 0n;
    const data = SELECTORS.balanceOf + padAddress(wallet);
    return hexToBigInt(await ethCall({ to: token, data, rpcUrl }));
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
    chainId = getActiveChainId(),
    waitConfirmations = 1,
}) {
    assertOfficialUsdtContract(usdtContract);
    await ensureBscNetwork(chainId);
    const amountWei = parseTokenAmount(amountUsd, 18);
    const txHash = await sendContractTx({
        from: walletAddress,
        to: usdtContract,
        data: SELECTORS.approve + padAddress(icoContract) + padUint256(amountWei),
        chainId,
    });
    if (waitConfirmations > 0) {
        await waitForConfirmations(txHash, { minConfirmations: waitConfirmations });
    }
    return txHash;
}

export async function readUserHeldRace({ icoContract, wallet, rpcUrl }) {
    if (!wallet || !icoContract) return 0n;
    return hexToBigInt(
        await ethCall({ to: icoContract, data: SELECTORS.userHeldRace + padAddress(wallet), rpcUrl }),
    );
}

export async function readPendingStakeCount({ icoContract, wallet, rpcUrl }) {
    if (!wallet || !icoContract) return 0;
    return Number(
        hexToBigInt(
            await ethCall({
                to: icoContract,
                data: SELECTORS.pendingStakeCount + padAddress(wallet),
                rpcUrl,
            }),
        ),
    );
}

export async function readIcoEndPriceUsdt({ icoContract, rpcUrl }) {
    if (!icoContract) return 0n;
    return hexToBigInt(await ethCall({ to: icoContract, data: SELECTORS.icoEndPriceUsdt, rpcUrl }));
}

/**
 * RaceICO.purchase — USDT→adminWallet, RACE from ICO reserve held on ICO (stake later after ICO ends).
 */
export async function purchaseIcoRace({
    walletAddress,
    icoContract,
    usdtContract,
    amountUsd,
    lockPeriodSeconds,
    chainId = getActiveChainId(),
    waitConfirmations = 3,
    rpcUrl = '',
}) {
    assertOfficialUsdtContract(usdtContract);
    await ensureBscNetwork(chainId);

    const amountWei = parseTokenAmount(amountUsd, 18);
    const lock = BigInt(lockPeriodSeconds ?? 0);
    const validLocks = new Set(ICO_STAKE_PLANS.map((p) => BigInt(p.lockPeriodSeconds)));
    if (!validLocks.has(lock)) {
        throw new Error(
            'Invalid stake plan. Select 180 / 365 / 730 / 1095 days (lock must be in seconds).',
        );
    }
    const allowance = await readErc20Allowance({
        token: usdtContract,
        owner: walletAddress,
        spender: icoContract,
        rpcUrl,
    });
    if (allowance < amountWei) {
        throw new Error('USDT allowance too low. Approve USDT first.');
    }

    const data = SELECTORS.purchase + padUint256(amountWei) + padUint256(lock);

    const preflightRpc =
        rpcUrl ||
        (Number(chainId) === 97 ? 'https://bsc-testnet-rpc.publicnode.com' : '');

    // Preflight with enough gas. MetaMask eth_call without gas often returns empty "0x" revert (OOG noise).
    await assertIcoPurchaseWouldSucceed({
        from: walletAddress,
        icoContract,
        data,
        rpcUrl: preflightRpc,
        lockPeriodSeconds: lock,
        amountWei,
    });

    const txHash = await sendContractTx({
        from: walletAddress,
        to: icoContract,
        data,
        chainId,
        gasFallback: 2_500_000,
        minGas: 1_500_000,
    });

    if (waitConfirmations > 0) {
        await waitForConfirmations(txHash, { minConfirmations: waitConfirmations });
    }

    return txHash;
}

/**
 * After icoCompleted: create Engine stake from one held purchase (end-price principal).
 */
export async function createIcoStake({
    walletAddress,
    icoContract,
    purchaseId,
    chainId = getActiveChainId(),
    waitConfirmations = 2,
    rpcUrl = '',
}) {
    await ensureBscNetwork(chainId);
    const id = BigInt(purchaseId ?? -1);
    if (id < 0n) {
        throw new Error('Invalid purchase id.');
    }
    const data = SELECTORS.createStake + padUint256(id);
    const preflightRpc =
        rpcUrl ||
        (Number(chainId) === 97 ? 'https://bsc-testnet-rpc.publicnode.com' : '');
    await assertIcoPurchaseWouldSucceed({
        from: walletAddress,
        icoContract,
        data,
        rpcUrl: preflightRpc,
        lockPeriodSeconds: 0,
        amountWei: 0n,
    });
    const txHash = await sendContractTx({
        from: walletAddress,
        to: icoContract,
        data,
        chainId,
        gasFallback: 4_000_000,
        minGas: 2_500_000,
    });
    if (waitConfirmations > 0) {
        await waitForConfirmations(txHash, { minConfirmations: waitConfirmations });
    }
    return txHash;
}

/** Create stakes for every held (unstaked) purchase of the wallet. */
export async function createAllIcoStakes({
    walletAddress,
    icoContract,
    chainId = getActiveChainId(),
    waitConfirmations = 2,
    rpcUrl = '',
}) {
    await ensureBscNetwork(chainId);
    const data = SELECTORS.createAllStakes;
    const preflightRpc =
        rpcUrl ||
        (Number(chainId) === 97 ? 'https://bsc-testnet-rpc.publicnode.com' : '');
    await assertIcoPurchaseWouldSucceed({
        from: walletAddress,
        icoContract,
        data,
        rpcUrl: preflightRpc,
        lockPeriodSeconds: 0,
        amountWei: 0n,
    });
    const txHash = await sendContractTx({
        from: walletAddress,
        to: icoContract,
        data,
        chainId,
        gasFallback: 6_000_000,
        minGas: 3_000_000,
    });
    if (waitConfirmations > 0) {
        await waitForConfirmations(txHash, { minConfirmations: waitConfirmations });
    }
    return txHash;
}

const PREFLIGHT_GAS = '0x4c4b40'; // 5_000_000

function isAmbiguousEmptyRevert(reason) {
    const r = String(reason || '')
        .trim()
        .toLowerCase();
    return (
        r === '' ||
        r === '0x' ||
        r === 'execution reverted' ||
        r === 'execution reverted: 0x' ||
        r === 'execution reverted:0x' ||
        /^execution reverted:\s*0x$/i.test(r)
    );
}

async function assertIcoPurchaseWouldSucceed({ from, icoContract, data, rpcUrl, lockPeriodSeconds, amountWei }) {
    const tx = { from, to: icoContract, data, gas: PREFLIGHT_GAS };
    let rpcOk = false;

    // Prefer public RPC — cleaner revert strings than MetaMask Internal JSON-RPC.
    if (rpcUrl) {
        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_call',
                    params: [tx, 'latest'],
                }),
            });
            const payload = await response.json();
            if (payload?.error) {
                const reason =
                    decodeSolidityErrorString(String(payload.error.data || '')) ||
                    String(payload.error.message || '');
                if (!isAmbiguousEmptyRevert(reason)) {
                    throw new Error(
                        mapIcoRevertToUserMessage(reason) ||
                            `ICO buy would fail: ${reason}`,
                    );
                }
                // Empty 0x from flaky RPC — try MetaMask / proceed.
            } else {
                rpcOk = true;
                return;
            }
        } catch (err) {
            const msg = String(err?.message || '');
            if (
                msg.startsWith('ICO buy would fail') ||
                msg.includes('RaceICO:') ||
                msg.includes('Invalid stake') ||
                msg.includes('USDT allowance') ||
                msg.includes('Insufficient') ||
                msg.includes('No active') ||
                msg.includes('sold out') ||
                msg.includes('paused')
            ) {
                throw err;
            }
            // RPC flake — fall through.
        }
    }

    if (rpcOk) {
        return;
    }

    try {
        await walletRequest({
            method: 'eth_call',
            params: [tx, 'latest'],
        });
    } catch (err) {
        const reason = extractRpcRevertMessage(err) || String(err?.data?.message || err?.message || '');
        if (reason && !isAmbiguousEmptyRevert(reason)) {
            throw new Error(mapIcoRevertToUserMessage(reason) || `ICO buy would fail: ${reason}`);
        }
        // Ambiguous MetaMask/RPC "execution reverted: 0x" is often wrong-chain or OOG noise.
        // Hard gate is eth_estimateGas inside sendContractTx (throws on real reverts).
        console.warn('ICO preflight ambiguous revert ignored', {
            reason,
            lockPeriodSeconds: String(lockPeriodSeconds ?? ''),
            amountWei: String(amountWei ?? ''),
            icoContract,
        });
    }
}

/** Custom errors from RaceRewardPriceOracle (reward mint / level income during ICO). */
const ORACLE_STALE_SELECTOR = '0x04578698';

function mapIcoRevertToUserMessage(reason) {
    const r = String(reason || '');
    const lower = r.toLowerCase();
    if (lower.includes(ORACLE_STALE_SELECTOR) || lower.includes('oraclestale')) {
        return 'RACE price oracle is stale (not updated in 24h). Admin must refresh the testnet oracle price, then retry.';
    }
    if (lower.includes('ico active') || lower.includes('no end price')) {
        return 'You Active Stake After Complete ICO.';
    }
    if (lower.includes('already staked')) {
        return 'This purchase is already staked.';
    }
    if (lower.includes('not buyer')) {
        return 'Only the buyer wallet can create this stake.';
    }
    if (lower.includes('bad plan')) {
        return 'Invalid stake plan. Select 180 / 365 / 730 / 1095 days.';
    }
    if (lower.includes('phase sold out') || lower.includes('phase usdt cap')) {
        return 'This ICO phase is sold out or over the USDT cap.';
    }
    if (lower.includes('total sold out') || lower.includes('completed')) {
        return 'ICO allocation is complete.';
    }
    if (lower.includes('reserve empty')) {
        return 'ICO reserve is not funded yet.';
    }
    if (lower.includes('phase inactive') || lower.includes('no active phase')) {
        return 'No active ICO phase.';
    }
    if (lower.includes('transfer amount exceeds allowance') || lower.includes('allowance')) {
        return 'USDT allowance too low. Approve USDT first.';
    }
    if (lower.includes('transfer amount exceeds balance') || lower.includes('insufficient')) {
        return 'Insufficient USDT balance.';
    }
    if (lower.includes('paused')) {
        return 'ICO is paused.';
    }
    if (r.startsWith('RaceICO:') || r.startsWith('engine:') || r.startsWith('RaceCoin:')) {
        return r;
    }
    return '';
}

/** Decode Solidity Error(string) — shared with friendlyIcoError. */
function decodeSolidityErrorString(data) {
    if (!data || typeof data !== 'string') {
        return '';
    }
    let hex = data.startsWith('0x') ? data.slice(2) : data;
    hex = hex.toLowerCase();
    const idx = hex.indexOf('08c379a0');
    if (idx < 0 || hex.length < idx + 8 + 64 + 64) {
        return '';
    }
    hex = hex.slice(idx);
    try {
        const len = Number.parseInt(hex.slice(8 + 64, 8 + 128), 16);
        if (!Number.isFinite(len) || len <= 0 || len > 256) {
            return '';
        }
        const strHex = hex.slice(8 + 128, 8 + 128 + len * 2);
        const bytes = strHex.match(/.{1,2}/g) || [];
        return bytes.map((b) => String.fromCharCode(Number.parseInt(b, 16))).join('');
    } catch {
        return '';
    }
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
