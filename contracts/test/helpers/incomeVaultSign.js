const { ethers } = require('ethers');

const DOMAIN_NAME = 'RaceIncomeVault';
const DOMAIN_VERSION = '1';

const CREDIT_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes('CreditIncome(address user,uint256 amount,bytes32 incomeType,bytes32 referenceId,uint256 deadline)'),
);
const MIGRATE_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes('MigrateIncome(address user,uint256 amount,bytes32 migrationId,uint256 deadline)'),
);
const TEAM_SETTLEMENT_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(
        'TeamWithdrawSettlement(address user,uint256 grossAmount,bytes32 withdrawalId,bytes32 payoutsHash,uint256 deadline)',
    ),
);

async function domain(vaultAddress, chainId) {
    return {
        name: DOMAIN_NAME,
        version: DOMAIN_VERSION,
        chainId,
        verifyingContract: vaultAddress,
    };
}

async function signCredit(signer, vaultAddress, chainId, user, amount, incomeType, referenceId, deadline) {
    const types = {
        CreditIncome: [
            { name: 'user', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'incomeType', type: 'bytes32' },
            { name: 'referenceId', type: 'bytes32' },
            { name: 'deadline', type: 'uint256' },
        ],
    };
    const value = { user, amount, incomeType, referenceId, deadline };
    return signer.signTypedData(await domain(vaultAddress, chainId), types, value);
}

async function signMigrate(signer, vaultAddress, chainId, user, amount, migrationId, deadline) {
    const types = {
        MigrateIncome: [
            { name: 'user', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'migrationId', type: 'bytes32' },
            { name: 'deadline', type: 'uint256' },
        ],
    };
    const value = { user, amount, migrationId, deadline };
    return signer.signTypedData(await domain(vaultAddress, chainId), types, value);
}

async function signTeamSettlement(
    signer,
    vaultAddress,
    chainId,
    user,
    grossAmount,
    withdrawalId,
    teamPayouts,
    deadline,
) {
    const payoutsHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
            ['tuple(address recipient,uint256 amount)[]'],
            [teamPayouts.map((p) => [p.recipient, p.amount])],
        ),
    );
    const types = {
        TeamWithdrawSettlement: [
            { name: 'user', type: 'address' },
            { name: 'grossAmount', type: 'uint256' },
            { name: 'withdrawalId', type: 'bytes32' },
            { name: 'payoutsHash', type: 'bytes32' },
            { name: 'deadline', type: 'uint256' },
        ],
    };
    const value = { user, grossAmount, withdrawalId, payoutsHash, deadline };
    const sig = await signer.signTypedData(await domain(vaultAddress, chainId), types, value);
    return { sig, payoutsHash };
}

module.exports = {
    signCredit,
    signMigrate,
    signTeamSettlement,
    CREDIT_TYPEHASH,
};
