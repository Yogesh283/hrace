<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_wallets', function (Blueprint $table) {
            $table->decimal('race_coin_balance', 16, 4)->default(0)->after('balance_usd');
        });

        Schema::create('race_coin_swaps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('swap_type', 32);
            $table->decimal('usdt_amount', 12, 2)->nullable();
            $table->decimal('coins_amount', 16, 4);
            $table->decimal('balance_after_coins', 16, 4);
            $table->string('tx_hash', 66)->nullable()->unique();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('race_coin_swaps');

        Schema::table('user_wallets', function (Blueprint $table) {
            $table->dropColumn('race_coin_balance');
        });
    }
};
