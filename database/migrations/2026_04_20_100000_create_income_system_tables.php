<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('balance_usd', 15, 2)->default(0)->after('wallet_address');
        });

        Schema::create('investments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount_usd', 15, 2);
            $table->decimal('roi_percent_monthly', 5, 2);
            $table->decimal('total_roi_paid_usd', 15, 2)->default(0);
            $table->decimal('cap_multiplier', 4, 2)->default(3);
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('next_roi_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('entry_type', 40)->index();
            $table->decimal('amount_usd', 15, 2);
            $table->decimal('balance_after_usd', 15, 2);
            $table->string('reference_type', 40)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });

        Schema::create('milestone_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('milestone_code', 10);
            $table->timestamps();

            $table->unique(['user_id', 'milestone_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('milestone_payouts');
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('investments');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('balance_usd');
        });
    }
};
