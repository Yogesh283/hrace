<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blockchain_participations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('investment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('wallet_address', 66);
            $table->string('tx_hash', 66)->unique();
            $table->unsignedInteger('stake_index');
            $table->decimal('principal_usdt', 20, 8);
            $table->unsignedBigInteger('lock_seconds')->default(0);
            $table->unsignedInteger('daily_rate_bps');
            $table->string('contract_address', 42);
            $table->timestamp('synced_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blockchain_participations');
    }
};
