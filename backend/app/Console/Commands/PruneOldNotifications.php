<?php

namespace App\Console\Commands;

use App\Models\UserNotification;
use Illuminate\Console\Command;

/**
 * Delete unread notifications older than the retention window (default 90 days).
 * Read notifications are kept so the user's history and receipts stay intact.
 * Runs daily via the Laravel scheduler (see bootstrap/app.php withSchedule).
 */
class PruneOldNotifications extends Command
{
    protected $signature = 'notifications:prune {--days=90 : Retention window in days for unread notifications}';

    protected $description = 'حذف اعلان‌های خوانده‌نشده قدیمی‌تر از پنجره نگهداری (پیش‌فرض ۹۰ روز)';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days);

        $deleted = UserNotification::whereNull('read_at')
            ->where('created_at', '<', $cutoff)
            ->delete();

        $this->info("{$deleted} اعلان خوانده‌نشده قدیمی‌تر از {$days} روز حذف شد.");

        return self::SUCCESS;
    }
}
