<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('on_chain_income_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('wallet_address', 42)->index();
            $table->string('event_name', 64);
            $table->string('income_type', 66)->nullable();
            $table->string('reference_id', 66)->nullable()->index();
            $table->string('withdrawal_id', 66)->nullable()->index();
            $table->decimal('amount', 24, 8)->default(0);
            $table->decimal('gross_amount', 24, 8)->nullable();
            $table->decimal('team_reward', 24, 8)->nullable();
            $table->decimal('admin_fee', 24, 8)->nullable();
            $table->decimal('net_amount', 24, 8)->nullable();
            $table->string('tx_hash', 66)->index();
            $table->unsignedBigInteger('block_number')->nullable();
            $table->unsignedInteger('log_index')->default(0);
            $table->string('contract_address', 42);
            $table->boolean('legacy_migrated')->default(false);
            $table->json('raw')->nullable();
            $table->timestamps();
            $table->unique(['tx_hash', 'log_index']);
        });

        Schema::create('on_chain_income_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->unique();
            $table->string('wallet_address', 42)->unique();
            $table->decimal('balance_amount', 24, 8)->default(0);
            $table->decimal('total_credited', 24, 8)->default(0);
            $table->decimal('total_withdrawn_gross', 24, 8)->default(0);
            $table->timestamp('last_indexed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('on_chain_income_balances');
        Schema::dropIfExists('on_chain_income_ledger');
    }
};
