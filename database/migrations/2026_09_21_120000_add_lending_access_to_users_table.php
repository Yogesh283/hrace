<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('lending_user_status', 16)->default('ACTIVE')->after('withdrawals_disabled');
            $table->timestamp('lending_blocked_at')->nullable()->after('lending_user_status');
            $table->unsignedBigInteger('lending_blocked_by')->nullable()->after('lending_blocked_at');
            $table->text('lending_block_reason')->nullable()->after('lending_blocked_by');

            $table->foreign('lending_blocked_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['lending_blocked_by']);
            $table->dropColumn([
                'lending_user_status',
                'lending_blocked_at',
                'lending_blocked_by',
                'lending_block_reason',
            ]);
        });
    }
};
