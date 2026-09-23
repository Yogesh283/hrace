<?php

namespace App\Services\Blockchain;

use App\Models\IncomeWalletTransaction;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Off-chain calculation + on-chain settlement bridge for RaceIncomeVault.
 */
class OnChainIncomeService
{
    public function __construct(
        private readonly IncomeVaultSettlementSigner $signer,
        private readonly IncomeVaultIndexer $indexer,
        private readonly BscJsonRpcClient $rpc,
    ) {}

    public function enabled(): bool
    {
        return (bool) config('income_vault.enabled')
            && config('income_vault.contract_address') !== '';
    }

    /**
     * Build settlement payload for creditIncome (relayer submits tx with signature).
     *
     * @return array<string, mixed>
     */
    public function buildCreditSettlement(
        User $user,
        string $amountUsd,
        string $incomeType,
        string $referenceKey,
        int $deadline,
    ): array {
        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($wallet === '') {
            throw new \InvalidArgumentException('User wallet required for on-chain income credit.');
        }

        $amountWei = $this->usdToWei($amountUsd);
        $incomeTypeHex = $this->signer->incomeTypeBytes32($incomeType);
        $referenceHex = $this->signer->referenceIdBytes32($referenceKey);
        $vault = (string) config('income_vault.contract_address');
        $chainId = (int) config('blockchain.chain_id');

        $structHash = $this->signer->creditStructHash($wallet, $amountWei, $incomeTypeHex, $referenceHex, $deadline);
        $domain = $this->signer->domainSeparator($vault, $chainId);
        $digest = $this->signer->hashTypedDataV4($domain, $structHash);

        return [
            'vault' => $vault,
            'chain_id' => $chainId,
            'user' => $wallet,
            'amount_wei' => $amountWei,
            'income_type' => $incomeTypeHex,
            'reference_id' => $referenceHex,
            'deadline' => $deadline,
            'typed_data_digest' => $digest,
            'note' => 'Sign digest with INCOME_VAULT_SETTLEMENT_PRIVATE_KEY and submit creditIncome via relayer.',
        ];
    }

    /**
     * After tx confirmation, verify IncomeCredited exists in indexer read model.
     */
    public function reconcileCreditReference(string $referenceKey, string $txHash): bool
    {
        $refHex = $this->signer->referenceIdBytes32($referenceKey);

        return \App\Models\OnChainIncomeLedgerEntry::query()
            ->where('tx_hash', strtolower($txHash))
            ->where('reference_id', $refHex)
            ->where('event_name', 'IncomeCredited')
            ->exists();
    }

    public function usdToWei(string $amountUsd): string
    {
        $decimals = 18;
        $parts = number_format((float) $amountUsd, $decimals, '.', '');
        [$whole, $frac] = array_pad(explode('.', $parts, 2), 2, '0');
        $frac = str_pad(substr($frac, 0, $decimals), $decimals, '0');

        return bcpow('10', (string) $decimals, 0) !== '0'
            ? bcadd(bcmul($whole, bcpow('10', (string) $decimals, 0), 0), $frac, 0)
            : '0';
    }

    /**
     * Mirror path: when authoritative mode is off, legacy virtual wallet still posts;
     * when on, callers should use buildCreditSettlement instead of VirtualIncomeWalletService::credit.
     */
    public function shouldSettleOnChainInsteadOfVirtualCredit(): bool
    {
        return $this->enabled() && (bool) config('income_vault.authoritative_balance');
    }

    public function logVirtualCreditBlocked(User $user, string $type, string $amount): void
    {
        if (! $this->shouldSettleOnChainInsteadOfVirtualCredit()) {
            return;
        }
        Log::warning('Virtual income credit skipped — on-chain vault authoritative', [
            'user_id' => $user->id,
            'type' => $type,
            'amount' => $amount,
        ]);
    }

    /** @return list<string> */
    public static function supportedVirtualCreditTypes(): array
    {
        return [
            IncomeWalletTransaction::TYPE_DAILY_REWARD,
            IncomeWalletTransaction::TYPE_LEVEL_INCOME,
            IncomeWalletTransaction::TYPE_TEAM_INCOME,
            IncomeWalletTransaction::TYPE_REFERRAL_INCOME,
            IncomeWalletTransaction::TYPE_OTHER_INCOME,
            IncomeWalletTransaction::TYPE_INCOME_CLAIM,
            IncomeWalletTransaction::TYPE_STAKE_UNLOCK_EMI,
        ];
    }
}
