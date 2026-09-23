<?php

namespace App\Services\Blockchain;

use App\Models\IncomeMigrationPlan;
use App\Models\User;
use App\Services\Income\VirtualIncomeWalletService;
use Illuminate\Support\Str;

/**
 * Prepares migration rows — does NOT submit on-chain transactions.
 */
class IncomeMigrationPlanner
{
    public function __construct(
        private readonly VirtualIncomeWalletService $virtualWallet,
        private readonly IncomeVaultSettlementSigner $signer,
    ) {}

    public function snapshotUser(User $user): IncomeMigrationPlan
    {
        $wallet = strtolower(trim((string) ($user->wallet_address ?? '')));
        if ($wallet === '') {
            throw new \InvalidArgumentException('User wallet required for migration snapshot.');
        }

        $legacy = $this->virtualWallet->sumBalance((int) $user->id);
        $migrationId = '0x'.hash('sha256', 'migrate:'.$user->id.':'.now()->timestamp);

        return IncomeMigrationPlan::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'status' => IncomeMigrationPlan::STATUS_PENDING,
            ],
            [
                'wallet_address' => $wallet,
                'migration_id' => $migrationId,
                'legacy_balance_usd' => $legacy,
                'planned_amount_usd' => $legacy,
                'chain_id' => (int) config('blockchain.chain_id', 97),
                'vault_address' => config('income_vault.contract_address'),
                'source_reference' => 'legacy_virtual_wallet_snapshot',
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function buildSignedPayload(IncomeMigrationPlan $plan, int $deadline): array
    {
        $amountWei = app(OnChainIncomeService::class)->usdToWei((string) $plan->planned_amount_usd);
        $vault = (string) ($plan->vault_address ?: config('income_vault.contract_address'));
        if ($vault === '') {
            throw new \RuntimeException('Vault address required for migration payload (deploy pending).');
        }

        $structHash = $this->signer->migrateStructHash(
            $plan->wallet_address,
            $amountWei,
            $plan->migration_id,
            $deadline,
        );
        $domain = $this->signer->domainSeparator($vault, (int) $plan->chain_id);
        $digest = $this->signer->hashTypedDataV4($domain, $structHash);

        $payload = [
            'migration_id' => $plan->migration_id,
            'user' => $plan->wallet_address,
            'amount_wei' => $amountWei,
            'deadline' => $deadline,
            'chain_id' => (int) $plan->chain_id,
            'vault' => $vault,
            'typed_data_digest' => $digest,
        ];

        $plan->forceFill([
            'status' => IncomeMigrationPlan::STATUS_SIGNED,
            'deadline' => $deadline,
            'signature_payload' => $payload,
        ])->save();

        return $payload;
    }
}
