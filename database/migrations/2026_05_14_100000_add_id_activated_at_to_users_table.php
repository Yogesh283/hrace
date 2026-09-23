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
            $table->timestamp('id_activated_at')->nullable()->after('is_blocked');
        });

        // Accounts that already existed before this rule: treat as activated.
        // New registrations keep id_activated_at = null until deposit threshold is met.
        DB::table('users')->update([
            'id_activated_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('id_activated_at');
        });
    }
};
