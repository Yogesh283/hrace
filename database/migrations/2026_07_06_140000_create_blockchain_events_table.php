<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blockchain_index_state', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('last_indexed_block')->default(0);
            $table->string('contract_address', 42);
            $table->timestamps();
        });

        Schema::create('blockchain_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('wallet_address', 66)->index();
            $table->string('contract_address', 42)->index();
            $table->string('event_name', 80)->index();
            $table->string('tx_hash', 66);
            $table->unsignedBigInteger('log_index');
            $table->unsignedBigInteger('block_number')->index();
            $table->json('payload');
            $table->timestamp('block_time')->nullable();
            $table->timestamps();

            $table->unique(['tx_hash', 'log_index']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blockchain_events');
        Schema::dropIfExists('blockchain_index_state');
    }
};
