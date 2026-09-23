/**
 * Shared test helper: deploy + wire RaceRewardPriceOracle for Engine reward minting.
 * Default: $1 USDT per 1 RACE (18 decimals), 7-day staleness (avoids flaking on time.increase(1 day)),
 * $0.01–$100 bounds.
 */
async function deployAndWireRewardOracle(ethers, owner, engine, priceUsdtPerRace) {
    const price = priceUsdtPerRace ?? ethers.parseEther('1');
    const RaceRewardPriceOracle = await ethers.getContractFactory('RaceRewardPriceOracle');
    const oracle = await RaceRewardPriceOracle.deploy(
        owner.address,
        price,
        7 * 24 * 60 * 60, // 7 days — tests that need stale set a shorter window
        ethers.parseEther('0.01'),
        ethers.parseEther('100'),
    );
    await engine.connect(owner).setRewardPriceOracle(await oracle.getAddress());
    return oracle;
}

/** Refresh heartbeat after long time.increase so reward settle can proceed. */
async function refreshOraclePrice(oracle, priceUsdtPerRace) {
    const price = priceUsdtPerRace ?? (await oracle.rawPriceUsdtPerRace());
    await oracle.updatePrice(price);
}

module.exports = { deployAndWireRewardOracle, refreshOraclePrice };
