/**
 * Decode a failed BSC Testnet tx: receipt, calldata, and replay revert reason.
 *
 *   cd contracts
 *   npm run compile
 *   node scripts/decode-testnet-tx.js 0xYOUR_TX_HASH
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const TX = process.argv[2];
const RPC =
    process.env.BSC_RPC_URL ||
    process.env.BSC_TESTNET_RPC ||
    'https://bsc-testnet.publicnode.com';

const ICO = '0x9C227938885f5fE4f91826EC6dB37ea54AC31C73';
const ENGINE = '0xa0791fAe5FFa14d0eBBA7e2c4F4710342dFDdD5D';
const USDT = '0xE30Fb617215c4EB5a0E4E6B1a5F537C0E28C8fEc';
const RACE = '0xbCAE5e637872a2760065ff9e9f6533ECC80122e6';
const ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1';

function loadArtifact(name) {
    const p = path.join(__dirname, '..', 'artifacts', 'src', `${name}.sol`, `${name}.json`);
    if (!fs.existsSync(p)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function decodeRevertData(data) {
    if (!data || data === '0x') {
        return '(no revert data — often internal call / Pancake pool missing)';
    }
    const hex = data.startsWith('0x') ? data : `0x${data}`;
    if (hex.startsWith('0x08c379a0')) {
        try {
            return ethers.AbiCoder.defaultAbiCoder().decode(['string'], `0x${hex.slice(10)}`)[0];
        } catch {
            return hex;
        }
    }
    if (hex.startsWith('0x4e487b71')) {
        try {
            const code = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], `0x${hex.slice(10)}`)[0];
            return `Panic(0x${code.toString(16)})`;
        } catch {
            return hex;
        }
    }
    return hex;
}

async function main() {
    if (!TX || !/^0x[a-fA-F0-9]{64}$/.test(TX)) {
        console.error('Usage: node scripts/decode-testnet-tx.js 0x<tx_hash>');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC, { chainId: 97, name: 'bsc-testnet' }, { staticNetwork: true });

    const [tx, receipt] = await Promise.all([provider.getTransaction(TX), provider.getTransactionReceipt(TX)]);
    if (!tx) {
        console.error('Transaction not found on testnet RPC.');
        process.exit(1);
    }

    console.log('--- Receipt ---');
    console.log('status:', receipt?.status === 1 ? 'SUCCESS' : receipt?.status === 0 ? 'FAIL' : '?');
    console.log('block:', receipt?.blockNumber?.toString());
    console.log('from:', tx.from);
    console.log('to:', tx.to);
    console.log('gasUsed:', receipt?.gasUsed?.toString());

    const icoArt = loadArtifact('RaceICO');
    const engineArt = loadArtifact('RaceCommunityEngine');

    if (tx.to?.toLowerCase() === ICO.toLowerCase() && icoArt) {
        const iface = new ethers.Interface(icoArt.abi);
        try {
            const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
            console.log('\n--- Calldata (RaceICO) ---');
            console.log('function:', parsed.name);
            console.log('args:', parsed.args.map((a) => (typeof a === 'bigint' ? a.toString() : a)));
            if (parsed.name === 'purchase') {
                const [usdtAmount, lockPeriod] = parsed.args;
                console.log('usdt:', ethers.formatEther(usdtAmount), 'lockPeriod seconds:', lockPeriod.toString());
            }
        } catch (e) {
            console.log('\nCalldata parse failed:', e.message);
        }
    } else {
        console.log('\n--- Calldata ---');
        console.log('selector:', tx.data.slice(0, 10));
    }

    if (receipt?.status === 0 && receipt.blockNumber) {
        console.log('\n--- Replay (eth_call at block before fail) ---');
        try {
            await provider.call(
                { from: tx.from, to: tx.to, data: tx.data, value: tx.value },
                receipt.blockNumber - 1n,
            );
            console.log('Replay at prior block: OK (state may have changed since)');
        } catch (e) {
            const data = e.data || e.info?.error?.data;
            console.log('revert reason:', e.reason || decodeRevertData(data) || e.shortMessage || e.message);
            if (data && !e.reason) {
                console.log('revert data:', data);
            }
        }
    }

    console.log('\n--- Pancake USDT→RACE (level income price) ---');
    const router = new ethers.Contract(
        ROUTER,
        ['function getAmountsOut(uint256,address[]) view returns (uint256[])'],
        provider,
    );
    try {
        const out = await router.getAmountsOut(ethers.parseEther('3'), [USDT, RACE]);
        console.log('3 USDT → RACE:', ethers.formatEther(out[1]));
    } catch (e) {
        console.log('getAmountsOut FAILED — no USDT/RACE pool; $50+ ICO often reverts on referral payout');
    }

    if (engineArt && tx.from) {
        const engine = new ethers.Contract(
            ENGINE,
            ['function referrerOf(address) view returns (address)', 'function isParticipationActive(address) view returns (bool)'],
            provider,
        );
        try {
            const ref = await engine.referrerOf(tx.from);
            const active = await engine.isParticipationActive(ref);
            console.log('\n--- Buyer referral ---');
            console.log('referrer:', ref);
            console.log('referrer participationActive:', active);
        } catch {
            /* optional */
        }
    }

    console.log('\nBscScan:', `https://testnet.bscscan.com/tx/${TX}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
