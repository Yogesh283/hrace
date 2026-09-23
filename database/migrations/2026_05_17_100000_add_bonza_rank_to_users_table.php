<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('bonza_rank_at')->nullable()->after('id_activated_at');
            $table->timestamp('bonza_direct_bonus_at')->nullable()->after('bonza_rank_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['bonza_rank_at', 'bonza_direct_bonus_at']);
        });
    }
};
