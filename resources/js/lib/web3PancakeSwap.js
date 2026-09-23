import { assertOfficialUsdtContract, ensureBscNetwork, parseTokenAmount, sendContractTx, waitForConfirmations } from '@/lib/web3Deposit';

const SELECTORS = {
    balanceOf: '0x70a08231',
    approve: '0x095ea7b3',
    getAmountsOut: '0xd06ca61f',
    swapSupportingFee: '0x5c11d795',
    factory: '0xc45a0155',
    getPair: '0xe6a43905',
    getReserves: '0x0902f1ac',
    token0: '0x0dfe1681',
};

function padAddress(address) {
    return address.slice(2).toLowerCase().padStart(64, '0');
}

function padUint256(value) {
    return BigInt(value).toString(16).padStart(64, '0');
}

function encodeAddressArray(path) {
    let encoded = padUint256(path.length);
    for (const addr of path) {
        encoded += padAddress(addr);
    }
    return encoded;
}

function encodeApprove(spender, amountWei) {
    return SELECTORS.approve + padAddress(spender) + padUint256(amountWei);
}

function encodeGetAmountsOut(amountIn, path) {
    const arrayData = encodeAddressArray(path);
    const arrayOffset = padUint256(64);
    return SELECTORS.getAmountsOut + padUint256(amountIn) + arrayOffset + arrayData;
}

function encodeSwapSupportingFee(amountIn, amountOutMin, path, to, deadline) {
    const arrayData = encodeAddressArray(path);
    const arrayOffset = padUint256(160);
    return (
        SELECTORS.swapSupportingFee +
        padUint256(amountIn) +
        padUint256(amountOutMin) +
        arrayOffset +
        padAddress(to) +
        padUint256(deadline) +
        arrayData
    );
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
            // fall through to public RPC
        }
    }

    if (!rpcUrl) {
        return '0x0';
    }

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

function decodeUint256Array(hex) {
    const raw = (hex || '0x').replace(/^0x/, '');
    if (raw.length < 128) {
        return [];
    }
    const offset = Number(BigInt(`0x${raw.slice(0, 64)}`)) * 2;
    const length = Number(BigInt(`0x${raw.slice(offset, offset + 64)}`));
    const amounts = [];
    for (let i = 0; i < length; i++) {
        const start = offset + 64 + i * 64;
        amounts.push(BigInt(`0x${raw.slice(start, start + 64)}`));
    }
    return amounts;
}

export function formatTokenWei(wei, decimals = 18, maxFraction = 6) {
    const value = BigInt(wei ?? 0);
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const frac = value % base;
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : String(whole);
}

export function applySlippage(amountOut, slippageBps = 100) {
    const bps = BigInt(slippageBps);
    return (amountOut * (10000n - bps)) / 10000n;
}

export async function readErc20Balance({ token, wallet, rpcUrl }) {
    if (!token || !wallet) {
        return 0n;
    }
    const data = SELECTORS.balanceOf + padAddress(wallet);
    return BigInt(await ethCall({ to: token, data, rpcUrl }));
}

export async function getSwapQuote({ router, path, amountIn, rpcUrl }) {
    if (!router || !path?.length || !amountIn || amountIn <= 0n) {
        return 0n;
    }
    const data = encodeGetAmountsOut(amountIn, path);
    const result = await ethCall({ to: router, data, rpcUrl });
    const amounts = decodeUint256Array(result);
    return amounts.length > 0 ? amounts[amounts.length - 1] : 0n;
}

export async function readRaceUsdtPrice({ router, raceToken, usdtContract, rpcUrl }) {
    const oneRace = 10n ** 18n;
    const usdtOut = await getSwapQuote({
        router,
        path: [raceToken, usdtContract],
        amountIn: oneRace,
        rpcUrl,
    });
    return usdtOut;
}

export async function readPairLiquidity({ router, raceToken, usdtContract, rpcUrl }) {
    if (!router || !raceToken || !usdtContract) {
        return null;
    }

    const factoryHex = await ethCall({ to: router, data: SELECTORS.factory, rpcUrl });
    const factory = `0x${factoryHex.slice(-40)}`;

    const pairData = SELECTORS.getPair + padAddress(usdtContract) + padAddress(raceToken);
    const pairHex = await ethCall({ to: factory, data: pairData, rpcUrl });
    const pair = `0x${pairHex.slice(-40)}`;

    if (pair === '0x0000000000000000000000000000000000000000') {
        return { pair: null, reserveUsdt: 0n, reserveRace: 0n };
    }

    const reservesHex = await ethCall({ to: pair, data: SELECTORS.getReserves, rpcUrl });
    const raw = reservesHex.replace(/^0x/, '');
    const reserve0 = BigInt(`0x${raw.slice(0, 64)}`);
    const reserve1 = BigInt(`0x${raw.slice(64, 128)}`);

    const token0Hex = await ethCall({ to: pair, data: SELECTORS.token0, rpcUrl });
    const token0 = `0x${token0Hex.slice(-40)}`.toLowerCase();

    const usdtLower = usdtContract.toLowerCase();
    const raceLower = raceToken.toLowerCase();

    let reserveUsdt;
    let reserveRace;
    if (token0 === usdtLower) {
        reserveUsdt = reserve0;
        reserveRace = reserve1;
    } else {
        reserveUsdt = reserve1;
        reserveRace = reserve0;
    }

    return { pair, reserveUsdt, reserveRace };
}

export async function swapExactTokens({
    walletAddress,
    router,
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMin,
    slippageBps = 100,
    deadlineSeconds = 1200,
    waitConfirmations = 3,
}) {
    await ensureBscNetwork();

    const path = [tokenIn, tokenOut];
    let minOut = amountOutMin;
    if (minOut === undefined || minOut === null) {
        const quoted = await getSwapQuote({ router, path, amountIn });
        minOut = applySlippage(quoted, slippageBps);
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

    await sendContractTx({
        from: walletAddress,
        to: tokenIn,
        data: encodeApprove(router, amountIn),
    });

    const swapData = encodeSwapSupportingFee(amountIn, minOut, path, walletAddress, deadline);
    const txHash = await sendContractTx({
        from: walletAddress,
        to: router,
        data: swapData,
    });

    if (waitConfirmations > 0) {
        await waitForConfirmations(txHash, { minConfirmations: waitConfirmations });
    }

    return txHash;
}

export async function buyRaceWithUsdt({
    walletAddress,
    router,
    usdtContract,
    raceToken,
    amountUsd,
    slippageBps,
    deadlineSeconds,
}) {
    assertOfficialUsdtContract(usdtContract);
    const amountIn = parseTokenAmount(amountUsd, 18);
    return swapExactTokens({
        walletAddress,
        router,
        tokenIn: usdtContract,
        tokenOut: raceToken,
        amountIn,
        slippageBps,
        deadlineSeconds,
    });
}

export async function sellRaceForUsdt({
    walletAddress,
    router,
    usdtContract,
    raceToken,
    amountRace,
    slippageBps,
    deadlineSeconds,
}) {
    assertOfficialUsdtContract(usdtContract);
    const amountIn = parseTokenAmount(amountRace, 18);
    return swapExactTokens({
        walletAddress,
        router,
        tokenIn: raceToken,
        tokenOut: usdtContract,
        amountIn,
        slippageBps,
        deadlineSeconds,
    });
}

export function friendlySwapError(error) {
    const message = error?.message || String(error ?? 'Unknown error');
    const code = error?.code;

    if (code === 4001 || /user rejected|denied|cancelled/i.test(message)) {
        return 'Transaction rejected in your wallet.';
    }
    if (/wrong network|chain/i.test(message)) {
        return 'Please switch to BNB Smart Chain (BSC) in your wallet.';
    }
    if (/insufficient funds/i.test(message)) {
        return 'Insufficient BNB for network gas fees.';
    }
    if (/insufficient|exceeds balance/i.test(message)) {
        return 'Insufficient token balance for this swap.';
    }
    if (/No Web3 wallet/i.test(message)) {
        return 'No Web3 wallet detected. Install MetaMask or Trust Wallet.';
    }
    if (/Only official BEP20 USDT/i.test(message)) {
        return 'Only official BEP20 USDT is supported.';
    }
    if (/execution reverted/i.test(message)) {
        return 'Swap reverted on-chain. Check liquidity, slippage, or token approval.';
    }
    if (/timeout/i.test(message)) {
        return 'Transaction confirmation timed out. Check BscScan for status.';
    }
    return message;
}
