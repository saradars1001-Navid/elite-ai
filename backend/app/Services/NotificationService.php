<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Log;
use Twilio\Rest\Client;

/**
 * Sends a user notification after important events (payment confirmed,
 * refund issued, …):
 *
 *  1. In-app: a row in user_notifications, fetched by the SPA.
 *  2. SMS (optional): a short Persian message via Twilio, enabled with
 *     NOTIFY_SMS_ENABLED=true. SMS never fails the main flow — failures are
 *     logged and skipped (the in-app notification is the source of truth).
 */
class NotificationService
{
    public function send(User $user, string $type, string $title, string $body, array $data = []): ?UserNotification
    {
        try {
            $notification = UserNotification::create([
                'user_id' => $user->id,
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'data' => $data ?: null,
            ]);
        } catch (\Throwable $e) {
            report($e);

            return null;
        }

        $this->sms($user, $title.' — '.$body);

        return $notification;
    }

    /**
     * Broadcast to many users (admin announcements): creates one in-app row per
     * active non-admin user, scoped by an optional query closure (audience).
     * Rows are bulk-inserted in chunks so it stays fast at scale. SMS is NOT
     * sent per user here — mass SMS must go through a queued job instead of a
     * synchronous web request; pass $sms=true only when you know the audience
     * is small.
     */
    public function broadcast(
        string $type,
        string $title,
        string $body,
        array $data = [],
        ?\Closure $scope = null,
        bool $sms = false
    ): int {
        $query = User::query()->where('role', '!=', 'admin')->where('status', 'active');
        if ($scope) {
            $scope($query);
        }

        $recipients = 0;
        $query->select('id')->chunkById(500, function ($users) use ($type, $title, $body, $data, $sms, &$recipients) {
            $now = now();
            $rows = [];
            foreach ($users as $user) {
                $rows[] = [
                    'user_id' => $user->id,
                    'type' => $type,
                    'title' => $title,
                    'body' => $body,
                    'data' => $data ? json_encode($data) : null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            UserNotification::insert($rows);
            $recipients += count($rows);

            if ($sms) {
                foreach ($users as $user) {
                    $this->sms($user, $title.' — '.$body);
                }
            }
        });

        return $recipients;
    }

    private function sms(User $user, string $text): void
    {
        if (! filter_var(config('services.twilio.sms_enabled', false), FILTER_VALIDATE_BOOL)) {
            return;
        }
        $sid = (string) config('services.twilio.account_sid');
        $token = (string) config('services.twilio.auth_token');
        $from = (string) config('services.twilio.from');
        if ($sid === '' || $token === '' || $from === '') {
            Log::warning('SMS notification skipped: Twilio is not configured.');

            return;
        }
        try {
            $client = new Client($sid, $token);
            $client->messages->create($user->phone, [
                'from' => $from,
                'body' => 'آکادمی ایلیت: '.mb_substr($text, 0, 150),
            ]);
        } catch (\Throwable $e) {
            Log::warning('SMS notification failed', ['phone' => $user->phone, 'error' => $e->getMessage()]);
        }
    }
}
