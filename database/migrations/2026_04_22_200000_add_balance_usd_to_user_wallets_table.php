<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_wallets', function (Blueprint $table) {
            $table->decimal('balance_usd', 15, 2)->default(0)->after('user_id');
        });

        if (Schema::hasTable('users')) {
            $driver = Schema::getConnection()->getDriverName();

            if ($driver === 'sqlite') {
                DB::statement('
                    UPDATE user_wallets
                    SET balance_usd = (
                        SELECT balance_usd FROM users WHERE users.id = user_wallets.user_id
                    )
                ');
            } else {
                DB::statement('
                    UPDATE user_wallets uw
                    INNER JOIN users u ON u.id = uw.user_id
                    SET uw.balance_usd = u.balance_usd
                ');
            }
        }
    }

    public function down(): void
    {
        Schema::table('user_wallets', function (Blueprint $table) {
            $table->dropColumn('balance_usd');
        });
    }
};
