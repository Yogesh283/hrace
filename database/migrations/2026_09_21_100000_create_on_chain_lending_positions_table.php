<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('on_chain_lending_positions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('chain_id');
            $table->string('contract_address', 66);
            $table->unsignedBigInteger('position_id');
            $table->string('wallet_address', 66)->index();
            $table->string('product_type', 32);
            $table->string('repayment_option', 32)->nullable();
            $table->decimal('selected_amount', 24, 8);
            $table->decimal('security_amount', 24, 8);
            $table->decimal('disbursement_amount', 24, 8);
            $table->decimal('repayment_amount', 24, 8);
            $table->decimal('repaid_amount', 24, 8)->default(0);
            $table->string('status', 32);
            $table->unsignedBigInteger('start_time')->nullable();
            $table->unsignedBigInteger('due_time')->nullable();
            $table->unsignedBigInteger('program_end_time')->nullable();
            $table->decimal('race_position_notional', 24, 8)->nullable();
            $table->string('create_tx_hash', 66)->nullable();
            $table->unsignedInteger('create_log_index')->nullable();
            $table->json('raw')->nullable();
            $table->timestamps();

            $table->unique(['chain_id', 'contract_address', 'position_id'], 'on_chain_lending_pos_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('on_chain_lending_positions');
    }
};
