<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedSmallInteger('member_number')->nullable()->unique()->after('id');
        });

        $this->backfillMemberNumbers();

        Schema::create('user_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique('user_id');
        });

        $now = now();
        foreach (DB::table('users')->orderBy('id')->pluck('id') as $userId) {
            DB::table('user_wallets')->insert([
                'user_id' => $userId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_wallets');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('member_number');
        });
    }

    private function backfillMemberNumbers(): void
    {
        $used = [];

        foreach (DB::table('users')->whereNotNull('member_number')->pluck('member_number') as $n) {
            $used[(int) $n] = true;
        }

        foreach (DB::table('users')->whereNull('member_number')->orderBy('id')->get() as $row) {
            $n = $this->pickUnusedFourDigit($used);
            DB::table('users')->where('id', $row->id)->update(['member_number' => $n]);
            $used[$n] = true;
        }
    }

    /**
     * @param  array<int, true>  $used
     */
    private function pickUnusedFourDigit(array &$used): int
    {
        for ($attempt = 0; $attempt < 500; $attempt++) {
            $n = random_int(1000, 9999);
            if (! isset($used[$n])) {
                return $n;
            }
        }

        throw new \RuntimeException('Could not assign a unique 4-digit member number.');
    }
};
