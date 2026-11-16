import { csrfHeaders } from '@/lib/csrf';
import { assertOfficialUsdtContract, ensureBscNetwork, parseTokenAmount, sendContractTx } from '@/lib/web3Deposit';

const SELECTORS = {
    approve: '0x095ea7b3',
    participate: '0x129874aa',
    claimReward: '0xae169a50',
    withdrawStake: '0x25d5971f',
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

function encodeParticipate(usdtWei, lockSeconds) {
    return SELECTORS.participate + padUint256(usdtWei) + padUint256(lockSeconds);
}

function encodeClaimReward(stakeIndex) {
    return SELECTORS.claimReward + padUint256(stakeIndex);
}

function encodeWithdrawStake(stakeIndex) {
    return SELECTORS.withdrawStake + padUint256(stakeIndex);
}

export async function purchaseOnChainParticipation({
    walletAddress,
    participationContract,
    usdtContract,
    amountUsd,
    lockSeconds,
}) {
    assertOfficialUsdtContract(usdtContract);
    await ensureBscNetwork();

    const amountWei = parseTokenAmount(amountUsd, 18);
    const approveData = encodeApprove(participationContract, amountWei);
    await sendContractTx({ from: walletAddress, to: usdtContract, data: approveData });

    const participateData = encodeParticipate(amountWei, lockSeconds);
    return sendContractTx({ from: walletAddress, to: participationContract, data: participateData });
}

export async function claimOnChainReward({ walletAddress, participationContract, stakeIndex }) {
    await ensureBscNetwork();
    const data = encodeClaimReward(stakeIndex);
    return sendContractTx({ from: walletAddress, to: participationContract, data });
}

export async function withdrawOnChainStake({ walletAddress, participationContract, stakeIndex }) {
    await ensureBscNetwork();
    const data = encodeWithdrawStake(stakeIndex);
    return sendContractTx({ from: walletAddress, to: participationContract, data });
}

export async function syncParticipationTx({ txHash, verifyUrl, attempts = 4 }) {
    let lastError = null;
    const maxAttempts = Math.max(1, Number(attempts) || 4);

    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(verifyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...csrfHeaders(),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ tx_hash: txHash }),
            });

            const payload = await response.json().catch(() => ({}));
            if (response.ok) {
                return payload;
            }

            lastError = new Error(payload.error || 'Could not index on-chain participation.');
            // Permanent client errors — don't spin.
            if (response.status === 422 || response.status === 409 || response.status === 403) {
                throw lastError;
            }
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (lastError.message && /already|linked|Connect your crypto wallet/i.test(lastError.message) && i === 0) {
                // still retry once for race with indexer
            }
        }

        if (i < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
        }
    }

    throw lastError || new Error('Could not index on-chain participation.');
}
