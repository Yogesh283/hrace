<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * On-chain ICO purchase index only — never a source of RACE ownership.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ico_purchases', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_id')->comment('On-chain purchase id');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('wallet_address', 42)->index();
            $table->unsignedTinyInteger('phase');
            $table->decimal('usdt_amount', 36, 18);
            $table->decimal('race_amount', 36, 18);
            $table->decimal('price', 36, 18);
            $table->string('tx_hash', 66)->index();
            $table->unsignedBigInteger('block_number')->nullable();
            $table->string('status', 32)->default('confirmed');
            $table->timestamps();

            $table->unique(['tx_hash', 'purchase_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ico_purchases');
    }
};
