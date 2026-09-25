import { ensureBscNetwork, sendContractTx } from '@/lib/web3Deposit';
import { formatTokenWei } from '@/lib/web3PancakeSwap';
import { getWalletProvider, walletRequest } from '@/lib/web3Wallet';

const SELECTORS = {
    approve: '0x095ea7b3',
    allowance: '0xdd62ed3e',
    holdOf: '0x9ddd7c21',
    quoteWithdraw: '0x150b7ba2',
    withdraw: '0x3ccfd60b',
    adminWallet: '0x36b19cd7',
    usdt: '0x2f48ab7d',
    raceToken: '0xb6ab179d',
    oneUsdt: '0x8c987386',
};

function padAddress(address) {
    return address.slice(2).toLowerCase().padStart(64, '0');
}

function padUint256(value) {
    return BigInt(value).toString(16).padStart(64, '0');
}

function encodeApprove(spender, amountWei) {
    return SELECTORS.approve + padAddress(spender) + padUint256(amountWei);
}

function encodeAllowance(owner, spender) {
    return SELECTORS.allowance + padAddress(owner) + padAddress(spender);
}

async function ethCall({ to, data, rpcUrl }) {
    async function viaRpc() {
        if (!rpcUrl) {
            return null;
        }
        try {
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
            const json = await response.json();
            if (json?.error) {
                return null;
            }
            return json?.result || '0x0';
        } catch {
            return null;
        }
    }

    async function viaWallet() {
        if (typeof window === 'undefined' || !getWalletProvider()) {
            return null;
        }
        try {
            const result = await walletRequest({
                method: 'eth_call',
                params: [{ to, data }, 'latest'],
            });
            return result || '0x0';
        } catch {
            return null;
        }
    }

    return (await viaWallet()) || (await viaRpc()) || '0x0';
}

function decodeUint(hex) {
    if (!hex || hex === '0x' || hex === '0x0') {
        return 0n;
    }
    return BigInt(hex);
}

function decodeAddress(hex) {
    if (!hex || hex.length < 66) {
        return '';
    }
    return `0x${hex.slice(-40)}`;
}

function decodeQuote(hex) {
    const raw = (hex || '0x').replace(/^0x/, '').padStart(320, '0');
    return {
        raceAmount: BigInt(`0x${raw.slice(0, 64)}`),
        valueUsdt: BigInt(`0x${raw.slice(64, 128)}`),
        feeUsdt: BigInt(`0x${raw.slice(128, 192)}`),
        teamRace: BigInt(`0x${raw.slice(192, 256)}`),
        netRace: BigInt(`0x${raw.slice(256, 320)}`),
    };
}

export function formatIncomeAmount(wei, decimals = 18, maxFraction = 4) {
    return formatTokenWei(wei, decimals, maxFraction);
}

export async function readIncomeHoldQuote({ incomeHold, walletAddress, rpcUrl }) {
    if (!incomeHold || !walletAddress) {
        return { raceAmount: 0n, valueUsdt: 0n, feeUsdt: 0n, teamRace: 0n, netRace: 0n };
    }
    const hex = await ethCall({
        to: incomeHold,
        data: SELECTORS.quoteWithdraw + padAddress(walletAddress),
        rpcUrl,
    });
    return decodeQuote(hex);
}

export async function readIncomeHoldOf({ incomeHold, walletAddress, rpcUrl }) {
    if (!incomeHold || !walletAddress) {
        return 0n;
    }
    const hex = await ethCall({
        to: incomeHold,
        data: SELECTORS.holdOf + padAddress(walletAddress),
        rpcUrl,
    });
    return decodeUint(hex);
}

export async function readIncomeHoldMeta({ incomeHold, rpcUrl }) {
    if (!incomeHold) {
        return { adminWallet: '', usdt: '', raceToken: '', oneUsdt: 0n };
    }
    const [adminHex, usdtHex, raceHex, oneHex] = await Promise.all([
        ethCall({ to: incomeHold, data: SELECTORS.adminWallet, rpcUrl }),
        ethCall({ to: incomeHold, data: SELECTORS.usdt, rpcUrl }),
        ethCall({ to: incomeHold, data: SELECTORS.raceToken, rpcUrl }),
        ethCall({ to: incomeHold, data: SELECTORS.oneUsdt, rpcUrl }),
    ]);
    return {
        adminWallet: decodeAddress(adminHex),
        usdt: decodeAddress(usdtHex),
        raceToken: decodeAddress(raceHex),
        oneUsdt: decodeUint(oneHex),
    };
}

export async function readUsdtAllowance({ usdt, owner, spender, rpcUrl }) {
    if (!usdt || !owner || !spender) {
        return 0n;
    }
    const hex = await ethCall({
        to: usdt,
        data: encodeAllowance(owner, spender),
        rpcUrl,
    });
    return decodeUint(hex);
}

export async function withdrawIncomeHold({
    walletAddress,
    incomeHold,
    usdtContract,
    feeUsdt,
}) {
    await ensureBscNetwork();
    if (!walletAddress || !incomeHold || !usdtContract) {
        throw new Error('Income hold contract is not configured.');
    }
    const fee = BigInt(feeUsdt || 0);
    if (fee > 0n) {
        const allowance = await readUsdtAllowance({
            usdt: usdtContract,
            owner: walletAddress,
            spender: incomeHold,
        });
        if (allowance < fee) {
            await sendContractTx({
                from: walletAddress,
                to: usdtContract,
                data: encodeApprove(incomeHold, fee),
            });
        }
    }
    return sendContractTx({
        from: walletAddress,
        to: incomeHold,
        data: SELECTORS.withdraw,
    });
}
