import {
    assertOfficialUsdtContract,
    ensureBscNetwork,
    getActiveChainId,
    parseTokenAmount,
    sendContractTx,
    waitForConfirmations,
} from '@/lib/web3Deposit';
import { getWalletProvider, NO_WALLET_MESSAGE, walletRequest } from '@/lib/web3Wallet';

const SELECTORS = {
    approve: '0x095ea7b3',
    register: '0x4420e486',
    participate: '0x129874aa',
    claimReward: '0xae169a50',
    compoundReward: '0x4060e257',
    withdrawStake: '0x25d5971f',
    matureStake: '0xdd2c4db5',
    claimMaturityEmi: '0xd6aa892a',
    isRegistered: '0xc3c5a547',
    referrerOf: '0xd21cacdf',
    isParticipationActive: '0x2d3e946c',
    stakeCount: '0x33060d90',
    stakeAt: '0x997db02d',
    pendingRewardUsdt: '0x7161d202',
    pendingRewardRace: '0xbbe3ae51',
    memberRank: '0xeab536fc',
    maturityEmiAt: '0x0c02525e',
    maturityEmiDueAt: '0x2c0815f5',
    claimEnabled: '2866ed21',
    lastSuccessfulClaimAt: '33ed0ae4',
    nextAllowedClaimAt: 'a461c2dc',
    canClaimRewards: 'a9b47a66',
    setClaimEnabled: '92929a09',
};

let memberStateInflight = null;
let memberStateCache = { key: '', value: null, at: 0 };
const MEMBER_STATE_TTL_MS = 15_000;

function padAddress(address) {
    return address.slice(2).toLowerCase().padStart(64, '0');
}

function padUint256(value) {
    return BigInt(value).toString(16).padStart(64, '0');
}

function encodeApprove(spender, amountWei) {
    return SELECTORS.approve + padAddress(spender) + padUint256(amountWei);
}

function encodeRegister(referrer) {
    const ref = referrer && referrer.startsWith('0x') ? referrer : '0x0000000000000000000000000000000000000000';
    return SELECTORS.register + padAddress(ref);
}

function encodeParticipate(usdtWei, lockSeconds) {
    return SELECTORS.participate + padUint256(usdtWei) + padUint256(lockSeconds);
}

function encodeClaimReward(stakeIndex) {
    return SELECTORS.claimReward + padUint256(stakeIndex);
}

function encodeCompoundReward(stakeIndex) {
    return SELECTORS.compoundReward + padUint256(stakeIndex);
}

function encodeWithdrawStake(stakeIndex) {
    return SELECTORS.withdrawStake + padUint256(stakeIndex);
}

function encodeMatureStake(stakeIndex) {
    return SELECTORS.matureStake + padUint256(stakeIndex);
}

function encodeClaimMaturityEmi(stakeIndex, emiNumber) {
    return SELECTORS.claimMaturityEmi + padUint256(stakeIndex) + padUint256(emiNumber);
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

    // Prefer configured Testnet RPC for read-only calls (MetaMask often wraps reverts as Internal JSON-RPC error).
    return (await viaRpc()) ?? (await viaWallet()) ?? '0x0';
}

export async function registerOnChain({
    walletAddress,
    engineContract,
    referrer,
    chainId = getActiveChainId(),
}) {
    await ensureBscNetwork(chainId);
    const data = encodeRegister(referrer);
    return sendContractTx({ from: walletAddress, to: engineContract, data, chainId });
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function normalizeWalletAddress(address) {
    if (!address || typeof address !== 'string') {
        return null;
    }
    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

function decodeAddressReturn(hex) {
    const raw = (hex || '0x').replace(/^0x/, '');
    if (raw.length < 40) {
        return ZERO_ADDRESS;
    }
    return `0x${raw.slice(-40).toLowerCase()}`;
}

function isZeroAddress(address) {
    if (!address) {
        return true;
    }
    return address.toLowerCase() === ZERO_ADDRESS;
}

/**
 * $50+ stake: sponsor must be participationActive on Engine or same-tx level income will not pay.
 */
export async function ensureSponsorActiveForLevelIncome({
    sponsorWallet,
    engineContract,
    rpcUrl,
    minStakeUsd = 50,
    stakeUsd,
}) {
    const amount = Number(stakeUsd);
    if (!Number.isFinite(amount) || amount < Number(minStakeUsd)) {
        return { ok: true, skipped: true };
    }

    const sponsor = normalizeWalletAddress(sponsorWallet);
    if (!sponsor || !engineContract) {
        return { ok: true, noSponsor: true };
    }

    const registered = await readIsRegistered({ walletAddress: sponsor, engineContract, rpcUrl });
    if (!registered) {
        throw new Error(
            'Your sponsor has not registered on-chain yet. Ask them to connect wallet on racenetwork.live first, then retry Buy & Stake.',
        );
    }

    const active = await readParticipationActive({ walletAddress: sponsor, engineContract, rpcUrl });
    if (!active) {
        throw new Error(
            'Your sponsor must complete $50+ Buy & Stake (active on-chain) before you stake — only then instant L1–L10 level income is paid in the same transaction.',
        );
    }

    return { ok: true, sponsorActive: true };
}

/**
 * Before ICO openIcoStake or Engine.participate: bind on-chain referrer so
 * CommunityReferralPaid (level income) can fire on the same stake tx.
 */
export async function ensureEngineReferralBeforeStake({
    walletAddress,
    engineContract,
    rpcUrl,
    sponsorWallet,
    chainId = getActiveChainId(),
    waitConfirmations: confirmCount = 1,
}) {
    await ensureBscNetwork(chainId);

    const self = normalizeWalletAddress(walletAddress);
    if (!self || !engineContract) {
        return { ok: false, reason: 'missing_wallet_or_engine' };
    }

    const registered = await readIsRegistered({ walletAddress: self, engineContract, rpcUrl });
    if (registered) {
        const onChainReferrer = await readReferrerOf({ walletAddress: self, engineContract, rpcUrl });
        const sponsor = normalizeWalletAddress(sponsorWallet);
        if (sponsor && isZeroAddress(onChainReferrer)) {
            throw new Error(
                'This wallet is already registered on-chain without a sponsor, so instant level income cannot apply. Use a fresh wallet linked under your sponsor, or complete registration before any stake.',
            );
        }
        return { ok: true, alreadyRegistered: true };
    }

    const sponsor = normalizeWalletAddress(sponsorWallet);
    if (sponsor && sponsor.toLowerCase() === self.toLowerCase()) {
        throw new Error('Invalid sponsor: cannot refer yourself.');
    }

    if (sponsor) {
        await ensureSponsorActiveForLevelIncome({
            sponsorWallet: sponsor,
            engineContract,
            rpcUrl,
            stakeUsd: 50,
        });
    }

    let referrer = ZERO_ADDRESS;
    let sponsorPendingOnboarding = false;
    if (sponsor) {
        const sponsorRegistered = await readIsRegistered({
            walletAddress: sponsor,
            engineContract,
            rpcUrl,
        });
        if (sponsorRegistered) {
            referrer = sponsor;
        } else {
            // New Engine may allow unregistered referrer; older bytecode requires registered upline.
            // Try binding sponsor first; fall back to zero so Buy & Stake is never blocked.
            referrer = sponsor;
            sponsorPendingOnboarding = true;
        }
    }

    try {
        const txHash = await registerOnChain({
            walletAddress: self,
            engineContract,
            referrer,
            chainId,
        });
        if (confirmCount > 0) {
            await waitForConfirmations(txHash, confirmCount);
        }
        memberStateCache = { key: '', value: null, at: 0 };
        return {
            ok: true,
            registered: true,
            txHash,
            sponsorBound: !isZeroAddress(referrer),
            sponsorPendingOnboarding,
        };
    } catch (err) {
        const msg = String(err?.message || err || '');
        if (
            sponsor &&
            sponsorPendingOnboarding &&
            /referrer not registered|engine: referrer/i.test(msg)
        ) {
            throw new Error(
                'Your sponsor must complete on-chain registration before you can stake — otherwise instant level income (L1–L10) will not be paid. Ask your sponsor to connect wallet once, then try Buy & Stake again.',
            );
        }
        throw err;
    }
}

export async function readReferrerOf({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) {
        return ZERO_ADDRESS;
    }
    const data = SELECTORS.referrerOf + padAddress(walletAddress);
    return decodeAddressReturn(await ethCall({ to: engineContract, data, rpcUrl }));
}

export async function purchaseOnChainParticipation({
    walletAddress,
    engineContract,
    usdtContract,
    amountUsd,
    lockSeconds,
    sponsorWallet,
    rpcUrl,
}) {
    assertOfficialUsdtContract(usdtContract);
    await ensureBscNetwork();

    await ensureEngineReferralBeforeStake({
        walletAddress,
        engineContract,
        rpcUrl,
        sponsorWallet,
        waitConfirmations: 1,
    });

    const amountWei = parseTokenAmount(amountUsd, 18);
    await sendContractTx({
        from: walletAddress,
        to: usdtContract,
        data: encodeApprove(engineContract, amountWei),
    });

    return sendContractTx({
        from: walletAddress,
        to: engineContract,
        data: encodeParticipate(amountWei, lockSeconds),
    });
}

export async function claimOnChainReward({ walletAddress, engineContract, stakeIndex }) {
    await ensureBscNetwork();
    return sendContractTx({
        from: walletAddress,
        to: engineContract,
        data: encodeClaimReward(stakeIndex),
    });
}

export async function compoundOnChainReward({ walletAddress, engineContract, stakeIndex }) {
    await ensureBscNetwork();
    return sendContractTx({
        from: walletAddress,
        to: engineContract,
        data: encodeCompoundReward(stakeIndex),
    });
}

export async function withdrawOnChainStake({ walletAddress, engineContract, stakeIndex }) {
    await ensureBscNetwork();
    return sendContractTx({
        from: walletAddress,
        to: engineContract,
        data: encodeWithdrawStake(stakeIndex),
    });
}

export async function matureOnChainStake({ walletAddress, engineContract, stakeIndex }) {
    await ensureBscNetwork();
    return sendContractTx({
        from: walletAddress,
        to: engineContract,
        data: encodeMatureStake(stakeIndex),
    });
}

export async function claimOnChainMaturityEmi({ walletAddress, engineContract, stakeIndex, emiNumber }) {
    await ensureBscNetwork();
    return sendContractTx({
        from: walletAddress,
        to: engineContract,
        data: encodeClaimMaturityEmi(stakeIndex, emiNumber),
    });
}

function decodeBool(hex) {
    try {
        return BigInt(hex || '0x0') === 1n;
    } catch {
        return false;
    }
}

function encodeSetClaimEnabled(enabled) {
    return `0x${SELECTORS.setClaimEnabled}${padUint256(enabled ? 1 : 0)}`;
}

export async function readClaimEnabled({ engineContract, rpcUrl }) {
    if (!engineContract) return false;
    const data = `0x${SELECTORS.claimEnabled}`;
    const hex = await ethCall({ to: engineContract, data, rpcUrl });
    if (!hex || hex === '0x' || hex === '0x0') {
        return false;
    }
    return decodeBool(hex);
}

export async function readNextAllowedClaimAt({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) return 0;
    const data = `0x${SELECTORS.nextAllowedClaimAt}${padAddress(walletAddress)}`;
    const hex = await ethCall({ to: engineContract, data, rpcUrl });
    if (!hex || hex === '0x' || hex === '0x0') {
        return 0;
    }
    try {
        return Number(BigInt(hex));
    } catch {
        return 0;
    }
}

export async function readCanClaimRewards({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) return false;
    const data = `0x${SELECTORS.canClaimRewards}${padAddress(walletAddress)}`;
    const hex = await ethCall({ to: engineContract, data, rpcUrl });
    if (!hex || hex === '0x' || hex === '0x0') {
        return false;
    }
    return decodeBool(hex);
}

/**
 * Safe bundle for UI — never throws. Returns supported=false when Engine bytecode lacks claim policy ABI.
 */
export async function readClaimPolicyState({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract) {
        return {
            supported: false,
            claimEnabled: false,
            canClaim: false,
            nextAllowedAt: 0,
        };
    }

    const probe = await ethCall({
        to: engineContract,
        data: `0x${SELECTORS.claimEnabled}`,
        rpcUrl,
    });
    if (!probe || probe === '0x' || probe === '0x0') {
        return {
            supported: false,
            claimEnabled: false,
            canClaim: false,
            nextAllowedAt: 0,
        };
    }

    const [claimEnabled, canClaim, nextAllowedAt] = await Promise.all([
        readClaimEnabled({ engineContract, rpcUrl }),
        walletAddress
            ? readCanClaimRewards({ walletAddress, engineContract, rpcUrl })
            : Promise.resolve(false),
        walletAddress
            ? readNextAllowedClaimAt({ walletAddress, engineContract, rpcUrl })
            : Promise.resolve(0),
    ]);

    return {
        supported: true,
        claimEnabled,
        canClaim,
        nextAllowedAt,
    };
}

export async function setClaimEnabledOnChain({ walletAddress, engineContract, enabled }) {
    await ensureBscNetwork();
    return sendContractTx({
        from: walletAddress,
        to: engineContract,
        data: encodeSetClaimEnabled(enabled),
    });
}

export function formatClaimCountdown(nextAllowedSec) {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, Number(nextAllowedSec || 0) - now);
    if (remaining <= 0) return null;
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function claimPolicyMessage({ icoCompleted, claimEnabled, canClaim, nextAllowedAt, supported = true }) {
    if (!supported) {
        return icoCompleted
            ? 'Claim policy reads unavailable on this Engine deployment (upgrade pending).'
            : 'Claiming is not active yet.';
    }
    if (!icoCompleted) {
        return 'Claiming is not active yet.';
    }
    if (!claimEnabled) {
        return 'Claiming will start when enabled.';
    }
    const countdown = formatClaimCountdown(nextAllowedAt);
    if (countdown) {
        return `Next claim available in: ${countdown}`;
    }
    if (canClaim) {
        return 'Claim Now';
    }
    return 'Claiming will start when enabled.';
}

export async function readChainIdHex() {
    if (typeof window === 'undefined' || !getWalletProvider()) {
        return null;
    }
    try {
        return await walletRequest({ method: 'eth_chainId' });
    } catch {
        return null;
    }
}

export function chainIdMatches(chainIdHex, expectedDecimal) {
    if (!chainIdHex) return false;
    const got = Number.parseInt(String(chainIdHex), 16);
    const expected = Number(expectedDecimal || 56);
    return Number.isFinite(got) && got === expected;
}

export async function readIsRegistered({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) return false;
    const data = SELECTORS.isRegistered + padAddress(walletAddress);
    return decodeBool(await ethCall({ to: engineContract, data, rpcUrl }));
}

export async function readParticipationActive({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) return false;
    const data = SELECTORS.isParticipationActive + padAddress(walletAddress);
    return decodeBool(await ethCall({ to: engineContract, data, rpcUrl }));
}

/**
 * One deduped read of on-chain member flags (register + participation).
 * Does not calculate rewards.
 */
export async function readEngineMemberState({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) {
        return { registered: false, participationActive: false };
    }

    const key = `${engineContract}:${walletAddress}:${rpcUrl || ''}`.toLowerCase();
    const now = Date.now();
    if (memberStateCache.key === key && now - memberStateCache.at < MEMBER_STATE_TTL_MS && memberStateCache.value) {
        return memberStateCache.value;
    }

    if (memberStateInflight && memberStateInflight.key === key) {
        return memberStateInflight.promise;
    }

    const promise = Promise.all([
        readIsRegistered({ walletAddress, engineContract, rpcUrl }),
        readParticipationActive({ walletAddress, engineContract, rpcUrl }),
    ]).then(([registered, participationActive]) => {
        const value = { registered, participationActive };
        memberStateCache = { key, value, at: Date.now() };
        memberStateInflight = null;
        return value;
    }).catch((error) => {
        memberStateInflight = null;
        throw error;
    });

    memberStateInflight = { key, promise };
    return promise;
}

export async function readStakeCount({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) return 0;
    const data = SELECTORS.stakeCount + padAddress(walletAddress);
    return Number(BigInt(await ethCall({ to: engineContract, data, rpcUrl })));
}

export async function readMemberRank({ walletAddress, engineContract, rpcUrl }) {
    if (!engineContract || !walletAddress) return 0;
    const data = SELECTORS.memberRank + padAddress(walletAddress);
    return Number(BigInt(await ethCall({ to: engineContract, data, rpcUrl })));
}

function decodeStakeAt(hex) {
    const raw = (hex || '0x').replace(/^0x/, '');
    const words = [];
    for (let i = 0; i < 8; i++) {
        const slice = raw.slice(i * 64, (i + 1) * 64);
        words.push(BigInt(`0x${slice || '0'}`));
    }
    return {
        principalUsdt: words[0],
        stakedRace: words[1],
        lockPeriod: Number(words[2]),
        startedAt: Number(words[3]),
        unlockAt: Number(words[4]),
        lastRewardAt: Number(words[5]),
        dailyRateBps: Number(words[6]),
        withdrawn: words[7] === 1n,
    };
}

export async function readStakeAt({ walletAddress, engineContract, index, rpcUrl }) {
    if (!engineContract || !walletAddress) {
        return null;
    }
    const data = SELECTORS.stakeAt + padAddress(walletAddress) + padUint256(index);
    return decodeStakeAt(await ethCall({ to: engineContract, data, rpcUrl }));
}

export async function readPendingRewardUsdt({ walletAddress, engineContract, stakeIndex, rpcUrl }) {
    if (!engineContract || !walletAddress) return 0n;
    const data = SELECTORS.pendingRewardUsdt + padAddress(walletAddress) + padUint256(stakeIndex);
    return BigInt(await ethCall({ to: engineContract, data, rpcUrl }));
}

export async function readPendingRewardRace({ walletAddress, engineContract, stakeIndex, rpcUrl }) {
    if (!engineContract || !walletAddress) return 0n;
    const data = SELECTORS.pendingRewardRace + padAddress(walletAddress) + padUint256(stakeIndex);
    return BigInt(await ethCall({ to: engineContract, data, rpcUrl }));
}

function decodeMaturityEmi(hex) {
    const raw = (hex || '0x').replace(/^0x/, '');
    if (!raw || raw.replace(/0/g, '') === '') {
        return {
            matured: false,
            closed: false,
            maturityAt: 0,
            principalRace: 0n,
            feeRace: 0n,
            emiPoolRace: 0n,
            emi1Race: 0n,
            emi2Race: 0n,
            emi3Race: 0n,
            claimed1: false,
            claimed2: false,
            claimed3: false,
        };
    }
    const words = [];
    for (let i = 0; i < 12; i++) {
        const slice = raw.slice(i * 64, (i + 1) * 64);
        words.push(BigInt(`0x${slice || '0'}`));
    }
    return {
        matured: words[0] === 1n,
        closed: words[1] === 1n,
        maturityAt: Number(words[2]),
        principalRace: words[3],
        feeRace: words[4],
        emiPoolRace: words[5],
        emi1Race: words[6],
        emi2Race: words[7],
        emi3Race: words[8],
        claimed1: words[9] === 1n,
        claimed2: words[10] === 1n,
        claimed3: words[11] === 1n,
    };
}

function decodeMaturityEmiDue(hex) {
    const raw = (hex || '0x').replace(/^0x/, '');
    const words = [];
    for (let i = 0; i < 3; i++) {
        const slice = raw.slice(i * 64, (i + 1) * 64);
        words.push(Number(BigInt(`0x${slice || '0'}`)));
    }
    return { due1: words[0], due2: words[1], due3: words[2] };
}

export async function readMaturityEmiAt({ walletAddress, engineContract, index, rpcUrl }) {
    if (!engineContract || !walletAddress) return null;
    const data = SELECTORS.maturityEmiAt + padAddress(walletAddress) + padUint256(index);
    const emi = decodeMaturityEmi(await ethCall({ to: engineContract, data, rpcUrl }));
    if (!emi.matured) return emi;
    const dueData = SELECTORS.maturityEmiDueAt + padAddress(walletAddress) + padUint256(index);
    const dues = decodeMaturityEmiDue(await ethCall({ to: engineContract, data: dueData, rpcUrl }));
    return { ...emi, ...dues };
}

export async function readAllOnChainStakes({ walletAddress, engineContract, rpcUrl }) {
    const count = await readStakeCount({ walletAddress, engineContract, rpcUrl });
    const stakes = [];
    for (let i = 0; i < count; i++) {
        const stake = await readStakeAt({ walletAddress, engineContract, index: i, rpcUrl });
        const pendingRewardRace = await readPendingRewardRace({
            walletAddress,
            engineContract,
            stakeIndex: i,
            rpcUrl,
        });
        const pendingRewardUsdt = await readPendingRewardUsdt({
            walletAddress,
            engineContract,
            stakeIndex: i,
            rpcUrl,
        });
        const maturityEmi = await readMaturityEmiAt({
            walletAddress,
            engineContract,
            index: i,
            rpcUrl,
        });
        stakes.push({
            index: i,
            ...stake,
            pendingRewardRace,
            pendingRewardUsdt,
            maturityEmi,
        });
    }
    return stakes;
}

export function friendlyEngineError(error) {
    const message = error?.message || String(error ?? 'Unknown error');
    const code = error?.code;

    if (code === 4001 || /user rejected|denied|cancelled/i.test(message)) {
        return 'Transaction rejected in your wallet.';
    }
    if (/wrong network|please switch metamask to bsc testnet|please switch metamask to bnb smart chain/i.test(message)) {
        return message;
    }
    if (/insufficient funds/i.test(message)) {
        return 'Insufficient BNB for network gas fees.';
    }
    if (/Only official BEP20 USDT/i.test(message)) {
        return 'Only official BEP20 USDT is supported.';
    }
    if (/execution reverted/i.test(message)) {
        if (/ico active/i.test(message)) {
            return 'Claiming is not active yet (ICO still running).';
        }
        if (/claim disabled/i.test(message)) {
            return 'Claiming will start when enabled by protocol admin.';
        }
        if (/claim cooldown/i.test(message)) {
            return '24-hour claim cooldown active. Try again later.';
        }
        return 'Contract call reverted. Check amount, lock tier, or activation rules.';
    }
    if (/No Web3 wallet/i.test(message)) {
        return NO_WALLET_MESSAGE;
    }
    if (/internal json-rpc error/i.test(message)) {
        return 'Network read failed. Confirm BSC Testnet, refresh the page, or retry in a moment.';
    }
    return message;
}
