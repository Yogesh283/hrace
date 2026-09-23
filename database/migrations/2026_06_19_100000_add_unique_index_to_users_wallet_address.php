<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if ($this->indexExists('users', 'users_wallet_address_unique')) {
            return;
        }

        $duplicates = DB::table('users')
            ->select('wallet_address')
            ->whereNotNull('wallet_address')
            ->where('wallet_address', '!=', '')
            ->groupBy('wallet_address')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('wallet_address');

        foreach ($duplicates as $address) {
            $keepId = DB::table('users')
                ->where('wallet_address', $address)
                ->orderBy('id')
                ->value('id');

            if ($keepId === null) {
                continue;
            }

            DB::table('users')
                ->where('wallet_address', $address)
                ->where('id', '!=', $keepId)
                ->update(['wallet_address' => null]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->unique('wallet_address', 'users_wallet_address_unique');
        });
    }

    public function down(): void
    {
        if (! $this->indexExists('users', 'users_wallet_address_unique')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_wallet_address_unique');
        });
    }

    private function indexExists(string $table, string $index): bool
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if ($driver === 'sqlite') {
            $result = DB::select(
                'SELECT COUNT(*) AS aggregate FROM sqlite_master WHERE type = ? AND tbl_name = ? AND name = ?',
                ['index', $table, $index],
            );

            return (int) ($result[0]->aggregate ?? 0) > 0;
        }

        $schema = $connection->getDatabaseName();

        $result = DB::select(
            'SELECT COUNT(*) AS aggregate FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ?',
            [$schema, $table, $index],
        );

        return (int) ($result[0]->aggregate ?? 0) > 0;
    }
};
