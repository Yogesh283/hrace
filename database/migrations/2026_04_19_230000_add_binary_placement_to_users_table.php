<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('binary_parent_id')->nullable()->after('referred_by')->constrained('users')->nullOnDelete();
            $table->string('binary_leg', 5)->nullable()->after('binary_parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['binary_parent_id']);
            $table->dropColumn(['binary_parent_id', 'binary_leg']);
        });
    }
};
