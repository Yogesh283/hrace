<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stake_unlocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('investment_id')->constrained()->cascadeOnDelete();
            $table->decimal('principal_usd', 15, 2);
            $table->decimal('admin_fee_usd', 15, 2);
            $table->decimal('emi_pool_usd', 15, 2);
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('unlocked_at');
            $table->timestamps();

            $table->unique('investment_id');
            $table->index(['user_id', 'status']);
        });

        Schema::create('stake_unlock_emis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stake_unlock_id')->constrained('stake_unlocks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('emi_number');
            $table->decimal('amount_usd', 15, 2);
            $table->timestamp('due_at')->index();
            $table->timestamp('paid_at')->nullable();
            $table->string('status', 20)->default('pending')->index();
            $table->timestamps();

            $table->unique(['stake_unlock_id', 'emi_number']);
            $table->index(['status', 'due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stake_unlock_emis');
        Schema::dropIfExists('stake_unlocks');
    }
};
