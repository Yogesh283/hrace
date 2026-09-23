<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otps', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();
            $table->string('type', 20)->index();
            $table->string('code_hash');
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->json('payload')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamp('consumed_at')->nullable()->index();
            $table->timestamps();

            $table->index(['email', 'type', 'consumed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('otps');
    }
};
