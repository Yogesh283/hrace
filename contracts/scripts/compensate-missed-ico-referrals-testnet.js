/**
 * Testnet only: pay pending ico_referral_compensations in RACE (manual level-income settlement).
 *
 *   cd /var/www/racenetwork.live
 *   php artisan migrate --force
 *   php artisan blockchain:compensate-missed-ico-referrals --sync-db --write-export
 *   cd contracts && CONFIRM_TESTNET_COMPENSATION=YES npm run compensate:missed-ico-referrals-testnet
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const hre = require('hardhat');
const { loadContractsEnv, envFirst, looksLikePlaceholderKey } = require('./lib/loadContractsEnv');

const EXPORT = path.join(__dirname, '..', '..', 'storage', 'app', 'ico-referral-compensation-export.json');

function loadPlan() {
    if (process.env.COMPENSATION_EXPORT && fs.existsSync(process.env.COMPENSATION_EXPORT)) {
        return JSON.parse(fs.readFileSync(process.env.COMPENSATION_EXPORT, 'utf8'));
    }
    if (fs.existsSync(EXPORT)) {
        return JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
    }
    const root = path.join(__dirname, '..', '..');
    execSync('php artisan blockchain:compensate-missed-ico-referrals --sync-db --write-export', {
        cwd: root,
        stdio: 'inherit',
    });
    if (!fs.existsSync(EXPORT)) {
        throw new Error('Export file missing after artisan — run migrate first.');
    }
    return JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
}

async function main() {
    loadContractsEnv();

    const network = await hre.ethers.provider.getNetwork();
    if (Number(network.chainId) !== 97) {
        throw new Error('STOP: testnet chain 97 only');
    }
    if (process.env.CONFIRM_TESTNET_COMPENSATION !== 'YES') {
        throw new Error('Set CONFIRM_TESTNET_COMPENSATION=YES to send RACE compensation transfers.');
    }
    if (envFirst('DEPLOY_ENV') !== 'testnet') {
        throw new Error('STOP: set DEPLOY_ENV=testnet in contracts/.env');
    }
    if (looksLikePlaceholderKey(process.env.DEPLOYER_PRIVATE_KEY)) {
        throw new Error(
            'STOP: DEPLOYER_PRIVATE_KEY missing in contracts/.env or Laravel .env (payer wallet must hold ≥51 RACE on testnet).',
        );
    }

    const signers = await hre.ethers.getSigners();
    if (!signers || signers.length === 0) {
        throw new Error('STOP: Hardhat has no accounts — check DEPLOYER_PRIVATE_KEY in contracts/.env');
    }
    const signer = signers[0];

    const manifest = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'deployments', 'bscTestnet', 'deployment.json'), 'utf8'),
    );
    const raceAddress = manifest.raceCoin;
    const token = (
        await hre.ethers.getContractAt(
            [
                'function transfer(address to, uint256 amount) returns (bool)',
                'function balanceOf(address) view returns (uint256)',
            ],
            raceAddress,
        )
    ).connect(signer);

    console.log('RACE', raceAddress);
    console.log('PAYER', signer.address);

    const plan = loadPlan();
    const buckets = plan.compensation_plan || [];
    if (buckets.length === 0) {
        console.log('No compensation buckets — nothing to pay.');
        return;
    }

    for (const bucket of buckets) {
        const to = bucket.sponsor_wallet;
        const raceHuman = bucket.total_race;
        const wei = hre.ethers.parseEther(String(raceHuman));
        const bal = await token.balanceOf(signer.address);
        if (bal < wei) {
            throw new Error(`Insufficient RACE on payer ${signer.address} need ${raceHuman}`);
        }
        console.log('TRANSFER', raceHuman, 'RACE ->', to);
        const tx = await token.transfer(to, wei);
        const receipt = await tx.wait();
        console.log('PAID', receipt.hash);

        const markPairs = (bucket.line_items || [])
            .map((line) => `${line.idempotency_key}:${receipt.hash}`)
            .join(',');
        if (markPairs !== '') {
            execSync(`php artisan blockchain:compensate-missed-ico-referrals --mark-paid=${markPairs}`, {
                cwd: path.join(__dirname, '..', '..'),
                stdio: 'inherit',
            });
        }
    }

    console.log('DONE compensation transfers.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
