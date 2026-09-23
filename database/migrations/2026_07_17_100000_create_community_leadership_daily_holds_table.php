<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_leadership_daily_holds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('hold_date');
            $table->unsignedTinyInteger('rank_level');
            $table->decimal('team_volume_usd', 18, 2)->default(0);
            $table->decimal('self_hold_usd', 18, 2)->default(0);
            $table->unsignedInteger('qualified_directs')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'hold_date']);
            $table->index(['hold_date', 'rank_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_leadership_daily_holds');
    }
};
