/**
 * Export ABIs for frontend / Laravel (no deploy).
 *   npm run export:abis
 */
const fs = require('fs');
const path = require('path');

const NAMES = [
    'RaceCoin',
    'RaceMultiSig',
    'RaceICO',
    'ICOContract',
    'RaceCommunityEngine',
    'RaceRewardVault',
    'RaceIncomeHold',
    'RaceRewardPriceOracle',
    'RaceTreasury',
];

const outDir = path.join(__dirname, '..', 'deployments', 'abis');
fs.mkdirSync(outDir, { recursive: true });

for (const name of NAMES) {
    const file = path.join(__dirname, '..', 'artifacts', 'src', `${name}.sol`, `${name}.json`);
    if (!fs.existsSync(file)) {
        console.warn('missing', name);
        continue;
    }
    const art = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(
        path.join(outDir, `${name}.abi.json`),
        JSON.stringify(art.abi, null, 2),
    );
    console.log('wrote', name);
}
console.log('ABIs →', outDir);
