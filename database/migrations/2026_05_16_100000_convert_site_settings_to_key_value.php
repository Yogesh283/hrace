<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('site_settings', 'key')) {
            return;
        }

        $address = null;
        $network = null;

        if (Schema::hasTable('site_settings')) {
            $row = DB::table('site_settings')->where('id', 1)->first()
                ?? DB::table('site_settings')->first();

            if ($row) {
                $address = $row->admin_wallet_bep20 ?? null;
                $network = $row->admin_network_label ?? null;
            }
        }

        Schema::dropIfExists('site_settings');

        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 64)->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        $now = now();
        foreach ([
            ['key' => 'address', 'value' => $address],
            ['key' => 'network_label', 'value' => $network],
        ] as $item) {
            if (! is_string($item['value']) || trim($item['value']) === '') {
                continue;
            }

            DB::table('site_settings')->insert([
                'key' => $item['key'],
                'value' => trim($item['value']),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('site_settings', 'key')) {
            return;
        }

        $address = DB::table('site_settings')->where('key', 'address')->value('value');
        $network = DB::table('site_settings')->where('key', 'network_label')->value('value');

        Schema::dropIfExists('site_settings');

        Schema::create('site_settings', function (Blueprint $table) {
            $table->id();
            $table->string('admin_wallet_bep20', 255)->nullable();
            $table->string('admin_network_label', 120)->nullable();
            $table->timestamps();
        });

        DB::table('site_settings')->insert([
            'id' => 1,
            'admin_wallet_bep20' => $address,
            'admin_network_label' => $network,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
