<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blockchain_vault_block_hashes', function (Blueprint $table) {
            $table->id();
            $table->string('contract_address', 42);
            $table->unsignedBigInteger('block_number');
            $table->string('block_hash', 66);
            $table->timestamps();
            $table->unique(['contract_address', 'block_number'], 'vault_block_hash_uniq');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blockchain_vault_block_hashes');
    }
};
