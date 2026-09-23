<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ico_stakes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('phase_id')->default(1);
            $table->decimal('purchase_price_usd', 18, 8);
            $table->decimal('usdt_paid', 18, 2);
            $table->decimal('race_amount', 24, 8);
            $table->unsignedInteger('duration_days');
            $table->decimal('daily_reward_percent', 8, 4);
            $table->string('status', 32)->default('active'); // active|completed|withdrawn
            $table->string('tx_hash', 80)->nullable()->unique();
            $table->timestamp('purchased_at')->nullable();
            $table->timestamp('unlock_at')->nullable();
            $table->timestamp('last_claim_at')->nullable();
            $table->decimal('total_claimed_race_coin', 24, 8)->default(0);
            $table->unsignedInteger('claim_count')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });

        Schema::create('ico_race_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('coins_amount', 24, 8);
            $table->decimal('admin_fee_usdt', 18, 2)->default(1);
            $table->string('fee_tx_hash', 80)->nullable()->unique();
            $table->string('wallet_address', 64);
            $table->string('status', 32)->default('pending'); // pending|completed|rejected
            $table->string('payout_tx_hash', 80)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ico_race_transfers');
        Schema::dropIfExists('ico_stakes');
    }
};
