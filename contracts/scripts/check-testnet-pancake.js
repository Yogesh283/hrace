/**
 * Verify Pancake V2 Testnet router candidate before writing to .env.
 *
 *   npm run check:testnet-pancake
 *
 * Never prints private keys. Never uses Mainnet router.
 */
const fs = require('fs');
const { ethers } = require('ethers');
const { ENV_PATH, loadContractsEnv, envFirst } = require('./lib/loadContractsEnv');
const {
    connectTestnetProvider,
    redactRpc,
    MAINNET_ROUTER,
} = require('./lib/testnetNetwork');

const CANDIDATE = '0xD99D1c33F9fC3444f8101754aBC46c52416550D1';
const ROUTER_ABI = [
    'function factory() view returns (address)',
    'function WETH() view returns (address)',
    'function getAmountsOut(uint256 amountIn, address[] calldata path) view returns (uint256[] memory amounts)',
    'function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)',
    'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)',
];

function upsertEnv(raw, updates) {
    const lines = raw.split(/\r?\n/);
    const found = new Set();
    const out = lines.map((line) => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return line;
        const i = t.indexOf('=');
        if (i < 0) return line;
        const k = t.slice(0, i).trim();
        if (Object.prototype.hasOwnProperty.call(updates, k)) {
            found.add(k);
            return `${k}=${updates[k]}`;
        }
        return line;
    });
    for (const [k, v] of Object.entries(updates)) {
        if (!found.has(k)) out.push(`${k}=${v}`);
    }
    return out.join('\n').replace(/\n*$/, '\n');
}

async function main() {
    loadContractsEnv();
    const write = process.argv.includes('--write') || process.env.WRITE_PANCAKE_ROUTER === '1';

    const { provider, rpc, chainId, blockNumber, flagErrors } = await connectTestnetProvider();
    console.log('NETWORK: BSC Testnet');
    console.log('RPC:', rpc ? redactRpc(rpc) : '(none)');
    console.log('CHAIN ID:', chainId);
    if (blockNumber != null) console.log('BLOCK:', blockNumber);

    if (flagErrors.length || !provider || chainId !== 97) {
        for (const e of flagErrors) console.error(e);
        console.log('STATUS: FAIL');
        process.exitCode = 1;
        return;
    }

    const configured = envFirst('PANCAKE_ROUTER', 'PANCAKE_ROUTER_ADDRESS');
    const routerAddr = configured || CANDIDATE;
    if (routerAddr.toLowerCase() === MAINNET_ROUTER.toLowerCase()) {
        console.error('STOP: Mainnet router refused on Testnet');
        console.log('STATUS: FAIL');
        process.exitCode = 1;
        return;
    }

    console.log('ROUTER:', routerAddr);

    const code = await provider.getCode(routerAddr);
    const codePresent = !!(code && code !== '0x');
    console.log('CODE PRESENT:', codePresent ? 'YES' : 'NO');
    if (!codePresent) {
        console.log('FACTORY: —');
        console.log('WETH: —');
        console.log('V2 COMPATIBLE: NO');
        console.log('STATUS: FAIL');
        process.exitCode = 1;
        return;
    }

    const router = new ethers.Contract(routerAddr, ROUTER_ABI, provider);
    let factory;
    let weth;
    let v2 = true;
    try {
        factory = await router.factory();
        weth = await router.WETH();
    } catch (e) {
        v2 = false;
        console.error('factory/WETH call failed:', e.message || e);
    }

    console.log('FACTORY:', factory || '—');
    console.log('WETH:', weth || '—');

    if (
        !factory ||
        !weth ||
        factory === ethers.ZeroAddress ||
        weth === ethers.ZeroAddress
    ) {
        v2 = false;
    } else {
        const fCode = await provider.getCode(factory);
        const wCode = await provider.getCode(weth);
        if (!fCode || fCode === '0x' || !wCode || wCode === '0x') {
            v2 = false;
            console.log('FACTORY/WETH code check: FAIL');
        } else {
            console.log('FACTORY CODE: YES');
            console.log('WETH CODE: YES');
        }
    }

    // Interface surface used by this project (existence via ABI encode — call may revert without pair).
    try {
        router.interface.getFunction('getAmountsOut');
        router.interface.getFunction('addLiquidity');
        router.interface.getFunction('swapExactTokensForTokensSupportingFeeOnTransferTokens');
    } catch {
        v2 = false;
    }

    console.log('V2 COMPATIBLE:', v2 ? 'YES' : 'NO');

    const ok =
        chainId === 97 &&
        codePresent &&
        v2 &&
        routerAddr.toLowerCase() === CANDIDATE.toLowerCase();

    if (!ok) {
        console.log('STATUS: FAIL');
        process.exitCode = 1;
        return;
    }

    console.log('STATUS: PASS');

    if (write) {
        if (!fs.existsSync(ENV_PATH)) {
            console.error('STOP: contracts/.env missing — cannot write PANCAKE_ROUTER');
            process.exitCode = 1;
            return;
        }
        const next = upsertEnv(fs.readFileSync(ENV_PATH, 'utf8'), {
            PANCAKE_ROUTER: CANDIDATE,
            PANCAKE_ROUTER_ADDRESS: CANDIDATE,
        });
        fs.writeFileSync(ENV_PATH, next);
        console.log('Configured PANCAKE_ROUTER (+ PANCAKE_ROUTER_ADDRESS) in contracts/.env');
    } else {
        console.log('Tip: re-run with --write to save PANCAKE_ROUTER into contracts/.env');
    }
}

main().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
});
