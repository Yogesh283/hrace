<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Orchid\Platform\Models\Role;
use Orchid\Support\Facades\Dashboard;

class GrantPlatformAdminCommand extends Command
{
    protected $signature = 'platform:grant-admin
                            {email? : User email to promote}
                            {--id= : User id instead of email}
                            {--password= : Optional password to set for /admin login}';

    protected $description = 'Grant full Orchid admin permissions (and Admin role) to an existing user';

    public function handle(): int
    {
        $user = $this->resolveUser();

        if ($user === null) {
            return self::FAILURE;
        }

        $user->forceFill([
            'permissions' => Dashboard::getAllowAllPermission(),
        ])->save();

        if ($this->option('password')) {
            $user->forceFill([
                'password' => Hash::make((string) $this->option('password')),
            ])->save();
            $this->info('Password updated for admin login.');
        }

        $this->ensureAdminRole($user);

        $this->info("Admin access granted to {$user->email} (id {$user->id}).");
        $this->line('Login at: '.url(config('platform.prefix', '/admin')));
        $this->line('Required permissions: platform.data, platform.systems.users, platform.systems.roles (all granted).');

        return self::SUCCESS;
    }

    private function ensureAdminRole(User $user): void
    {
        $role = Role::query()->firstOrCreate(
            ['slug' => 'admin'],
            [
                'name' => 'Admin',
                'permissions' => Dashboard::getAllowAllPermission(),
            ],
        );

        $role->forceFill([
            'permissions' => Dashboard::getAllowAllPermission(),
        ])->save();

        if (method_exists($user, 'replaceRoles')) {
            $user->replaceRoles([$role->id]);
        } elseif (method_exists($user, 'roles')) {
            $user->roles()->syncWithoutDetaching([$role->id]);
        }
    }

    private function resolveUser(): ?User
    {
        $id = $this->option('id');

        if ($id !== null) {
            $user = User::query()->find($id);

            if ($user === null) {
                $this->error("No user with id {$id}.");

                return null;
            }

            return $user;
        }

        $email = $this->argument('email') ?? $this->ask('Email of the user to promote');

        if (! is_string($email) || $email === '') {
            $this->error('Email is required.');

            return null;
        }

        $user = User::query()->where('email', $email)->first();

        if ($user === null) {
            $this->error("No user found for {$email}.");

            return null;
        }

        return $user;
    }
}
