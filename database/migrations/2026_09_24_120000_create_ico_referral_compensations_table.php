<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ico_referral_compensations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('ico_purchase_id');
            $table->unsignedBigInteger('sponsor_user_id')->nullable();
            $table->string('sponsor_wallet', 42);
            $table->unsignedTinyInteger('level');
            $table->decimal('amount_usd', 18, 2);
            $table->decimal('amount_race', 18, 4);
            $table->string('stake_tx_hash', 66);
            $table->string('payout_tx_hash', 66)->nullable();
            $table->string('status', 20)->default('pending');
            $table->string('idempotency_key', 120)->unique();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['status', 'sponsor_wallet']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ico_referral_compensations');
    }
};
