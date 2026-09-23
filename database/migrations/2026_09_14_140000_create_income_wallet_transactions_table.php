<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('income_wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('wallet_address', 255)->nullable();
            $table->string('type', 64);
            $table->string('source_reference', 128)->nullable();
            $table->decimal('amount', 20, 4);
            $table->string('asset', 16)->default('USDT');
            $table->string('direction', 8);
            $table->string('status', 24)->default('posted');
            $table->string('idempotency_key', 128)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'idempotency_key'], 'income_wallet_idempotency_unique');
            $table->index(['user_id', 'type']);
            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'direction', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('income_wallet_transactions');
    }
};
