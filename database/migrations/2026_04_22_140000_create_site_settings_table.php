<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->string('admin_wallet_bep20', 255)->nullable();
            $table->string('admin_network_label', 120)->nullable();
            $table->timestamps();
        });

        DB::table('site_settings')->insert([
            'id' => 1,
            'admin_wallet_bep20' => null,
            'admin_network_label' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('site_settings');
    }
};
