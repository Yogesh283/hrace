<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('level')->default(1)->after('email');
            $table->string('referral_code', 12)->nullable()->unique()->after('level');
            $table->string('joined_with_code', 12)->nullable()->after('referral_code');
            $table->foreignId('referred_by')->nullable()->after('joined_with_code')->constrained('users')->nullOnDelete();
            $table->boolean('is_blocked')->default(false)->after('referred_by');
        });

        foreach (DB::table('users')->orderBy('id')->cursor() as $row) {
            DB::table('users')->where('id', $row->id)->update([
                'referral_code' => $this->uniqueReferralCode(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['referred_by']);
            $table->dropColumn([
                'level',
                'referral_code',
                'joined_with_code',
                'referred_by',
                'is_blocked',
            ]);
        });
    }

    private function uniqueReferralCode(): string
    {
        do {
            $code = strtoupper(Str::random(8));
        } while (DB::table('users')->where('referral_code', $code)->exists());

        return $code;
    }
};
