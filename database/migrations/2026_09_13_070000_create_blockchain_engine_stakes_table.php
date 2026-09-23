<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Read-model for RaceCommunityEngine stakes (indexed events + optional RPC enrichment).
 * Not a source of RACE ownership — on-chain Engine is authoritative.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blockchain_engine_stakes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('wallet_address', 42)->index();
            $table->unsignedInteger('stake_index');
            $table->unsignedBigInteger('ico_purchase_id')->nullable();
            $table->decimal('principal_usdt', 36, 18);
            $table->decimal('staked_race', 36, 18);
            $table->unsignedBigInteger('lock_seconds')->default(0);
            $table->unsignedInteger('daily_rate_bps')->default(0);
            $table->unsignedBigInteger('started_at')->nullable()->comment('unix seconds from chain');
            $table->unsignedBigInteger('unlock_at')->nullable()->comment('unix seconds from chain');
            $table->string('source_type', 32)->default('ico');
            $table->boolean('withdrawn')->default(false);
            $table->string('status', 32)->default('active');
            $table->string('tx_hash', 66)->index();
            $table->unsignedBigInteger('block_number')->nullable();
            $table->string('contract_address', 42);
            $table->timestamps();

            $table->unique(['wallet_address', 'stake_index', 'contract_address'], 'engine_stakes_wallet_index_contract');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blockchain_engine_stakes');
    }
};
