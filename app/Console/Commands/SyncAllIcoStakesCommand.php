<?php

namespace App\Console\Commands;

use App\Services\Blockchain\IcoStakeFullSyncService;
use Illuminate\Console\Command;

class SyncAllIcoStakesCommand extends Command
{
    protected $signature = 'blockchain:sync-all-ico-stakes';

    protected $description = 'Sync RaceICO holds/stakes into ico_purchases status + blockchain_engine_stakes (with user_id)';

    public function handle(IcoStakeFullSyncService $sync): int
    {
        $this->info('Syncing ICO hold/stake state from RaceICO…');

        try {
            $result = $sync->syncAll();
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info(
            'ico_completed='.($result['ico_completed'] ? 'yes' : 'no')
            .' purchases='.$result['on_chain_purchases']
            .' held='.$result['held']
            .' staked='.$result['staked']
            .' stakes_upserted='.$result['stakes_upserted']
            .' purchases_marked='.$result['purchases_marked']
            .' linked_users='.$result['linked_users']
            .' engine_ico_stake_rows='.$result['engine_stake_rows']
        );

        if ($result['ico_completed'] && $result['staked'] === 0) {
            $this->warn('ICO is complete, but no createStake() yet. After users stake, run this command again (or rely on live tx sync).');
        }

        return self::SUCCESS;
    }
}
