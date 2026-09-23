// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Mirrors Laravel RewardPlan::calculateWalletWithdrawalFee / calculatePayoutAdminFee (2 dp USD).
 * Amounts are token base units where 1 USD = 10**tokenDecimals (e.g. 1e18 on testnet USDT).
 */
library IncomeVaultFeeLib {
    uint256 internal constant USD_CENT_SCALE = 100;

    error IncomeVaultFee__ZeroGross();

    function grossToUsdCents(uint256 grossAmount, uint8 tokenDecimals) internal pure returns (uint256 cents) {
        if (grossAmount == 0) revert IncomeVaultFee__ZeroGross();
        uint256 oneUsd = 10 ** uint256(tokenDecimals);
        cents = (grossAmount * USD_CENT_SCALE) / oneUsd;
    }

    function usdCentsToAmount(uint256 cents, uint8 tokenDecimals) internal pure returns (uint256) {
        uint256 oneUsd = 10 ** uint256(tokenDecimals);
        return (cents * oneUsd) / USD_CENT_SCALE;
    }

    /**
     * @return teamReward adminFee net — all in token base units.
     */
    function calculateWithdrawalFees(uint256 grossAmount, uint8 tokenDecimals)
        internal
        pure
        returns (uint256 teamReward, uint256 adminFee, uint256 net)
    {
        if (grossAmount == 0) revert IncomeVaultFee__ZeroGross();
        uint256 cents = grossToUsdCents(grossAmount, tokenDecimals);
        uint256 teamCents = (cents * 10) / 100;
        uint256 adminCents;
        if (cents < 10000) {
            adminCents = 100;
        } else {
            adminCents = (cents * 1) / 100;
        }
        teamReward = usdCentsToAmount(teamCents, tokenDecimals);
        adminFee = usdCentsToAmount(adminCents, tokenDecimals);
        net = grossAmount - teamReward - adminFee;
    }
}
