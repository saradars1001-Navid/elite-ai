<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Promote (or create) an admin account by phone number.
 *
 * Admin access is never granted by a hard-coded shortcut in the UI; the role
 * lives in the database and is set here, once, by whoever operates the API.
 */
class MakeAdmin extends Command
{
    protected $signature = 'academy:make-admin {phone : Iranian mobile number, e.g. 09121234567} {--name=مدیر پلتفرم}';

    protected $description = 'Grant the admin role to a phone number (creates the account if it does not exist yet)';

    public function handle(): int
    {
        $digits = preg_replace('/\D+/', '', (string) $this->argument('phone')) ?? '';
        if (str_starts_with($digits, '0098')) {
            $digits = substr($digits, 2);
        }
        if (str_starts_with($digits, '98')) {
            $normalized = '+'.$digits;
        } elseif (str_starts_with($digits, '0')) {
            $normalized = '+98'.substr($digits, 1);
        } else {
            $normalized = '+98'.$digits;
        }

        if (! preg_match('/^\+989\d{9}$/', $normalized)) {
            $this->error('شماره موبایل معتبر نیست. مثال: 09121234567');

            return self::FAILURE;
        }

        $user = User::firstOrCreate(
            ['phone' => $normalized],
            ['id' => (string) Str::uuid(), 'name' => (string) $this->option('name')]
        );
        $user->update(['role' => 'admin', 'status' => 'active']);

        $this->info("حساب مدیر آماده است: {$user->name} — {$user->phone}");

        return self::SUCCESS;
    }
}
