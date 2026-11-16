<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Allow multiple stakes from one createAllStakes tx, and add unified fund flow ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('blockchain_participations')) {
            $this->dropTxHashOnlyUnique();

            Schema::table('blockchain_participations', function (Blueprint $table) {
                $table->unique(['tx_hash', 'stake_index'], 'blockchain_participations_tx_stake_unique');
            });
        }

        if (! Schema::hasTable('user_fund_transactions')) {
            Schema::create('user_fund_transactions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->string('type', 48)->index();
                $table->string('direction', 8)->default('in'); // in | out | info
                $table->decimal('amount_usd', 20, 8)->nullable();
                $table->decimal('amount_race', 36, 18)->nullable();
                $table->string('tx_hash', 66)->nullable()->index();
                $table->unsignedInteger('stake_index')->nullable();
                $table->string('reference_type', 64)->nullable();
                $table->unsignedBigInteger('reference_id')->nullable();
                $table->string('title', 160)->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'created_at']);
                $table->index(['reference_type', 'reference_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_fund_transactions');

        if (Schema::hasTable('blockchain_participations')) {
            Schema::table('blockchain_participations', function (Blueprint $table) {
                try {
                    $table->dropUnique('blockchain_participations_tx_stake_unique');
                } catch (\Throwable) {
                }
                $table->unique('tx_hash');
            });
        }
    }

    private function dropTxHashOnlyUnique(): void
    {
        try {
            Schema::table('blockchain_participations', function (Blueprint $table) {
                $table->dropUnique(['tx_hash']);
            });

            return;
        } catch (\Throwable) {
            // Fall through to raw MySQL index drop.
        }

        try {
            DB::statement('ALTER TABLE blockchain_participations DROP INDEX blockchain_participations_tx_hash_unique');
        } catch (\Throwable) {
            // Already dropped or different name.
        }
    }
};
