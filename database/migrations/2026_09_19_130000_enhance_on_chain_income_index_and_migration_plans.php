<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('on_chain_income_ledger', function (Blueprint $table) {
            $table->unsignedInteger('chain_id')->default(97)->after('id');
            $table->string('block_hash', 66)->nullable()->after('block_number');
            $table->string('event_signature', 66)->nullable()->after('event_name');
        });

        Schema::table('on_chain_income_ledger', function (Blueprint $table) {
            $table->dropUnique(['tx_hash', 'log_index']);
            $table->unique(['chain_id', 'tx_hash', 'log_index'], 'on_chain_income_event_identity');
        });

        Schema::create('income_migration_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('wallet_address', 42)->index();
            $table->string('migration_id', 66)->unique();
            $table->decimal('legacy_balance_usd', 24, 8)->default(0);
            $table->decimal('planned_amount_usd', 24, 8)->default(0);
            $table->string('income_type', 64)->nullable();
            $table->string('source_reference', 191)->nullable();
            $table->unsignedBigInteger('nonce')->default(0);
            $table->unsignedBigInteger('deadline')->nullable();
            $table->unsignedInteger('chain_id')->default(97);
            $table->string('vault_address', 42)->nullable();
            $table->string('status', 32)->default('PENDING')->index();
            $table->string('tx_hash', 66)->nullable();
            $table->json('signature_payload')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('income_migration_plans');

        Schema::table('on_chain_income_ledger', function (Blueprint $table) {
            $table->dropUnique('on_chain_income_event_identity');
            $table->unique(['tx_hash', 'log_index']);
            $table->dropColumn(['chain_id', 'block_hash', 'event_signature']);
        });
    }
};
