<?php

namespace App\Services;

use App\Models\PaymentEvent;
use Illuminate\Support\Facades\Log;

/**
 * Audit log for payment notifications. start() records the incoming event
 * (payload snapshot), finish() closes it with the final status, verification
 * result and any error. Logging failures are swallowed so a broken log store
 * can never block a real payment.
 */
final class PaymentEventLogger
{
    public static function start(
        string $source,
        string $type,
        ?string $referenceType,
        ?string $referenceId,
        array $payload
    ): ?int {
        try {
            $event = PaymentEvent::create([
                'source' => $source,
                'gateway' => (string) env('PAYMENT_GATEWAY', 'unknown'),
                'type' => $type,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'status' => 'received',
                'payload' => $payload,
                'ip' => request()->ip(),
            ]);

            return (int) $event->id;
        } catch (\Throwable $e) {
            Log::warning('payment-event-log failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    public static function finish(int $id, string $status, ?array $verifyResult = null, ?string $error = null): void
    {
        try {
            PaymentEvent::whereKey($id)->update([
                'status' => $status,
                'verify_result' => $verifyResult,
                'error' => $error,
            ]);
        } catch (\Throwable $e) {
            Log::warning('payment-event-log finish failed', ['error' => $e->getMessage()]);
        }
    }

    /** Attach the resolved reference (purchase/wallet id) to an open log row. */
    public static function reference(int $id, string $referenceType, string $referenceId): void
    {
        try {
            PaymentEvent::whereKey($id)->update(['reference_type' => $referenceType, 'reference_id' => $referenceId]);
        } catch (\Throwable $e) {
            Log::warning('payment-event-log reference failed', ['error' => $e->getMessage()]);
        }
    }

    /** Attach the notification type (payment/refund) to an open log row. */
    public static function type(int $id, string $type): void
    {
        try {
            PaymentEvent::whereKey($id)->update(['type' => $type]);
        } catch (\Throwable $e) {
            Log::warning('payment-event-log type failed', ['error' => $e->getMessage()]);
        }
    }

    /** Record the gateway verify result without closing the row yet. */
    public static function verify(int $id, array $verify): void
    {
        try {
            PaymentEvent::whereKey($id)->update(['verify_result' => $verify]);
        } catch (\Throwable $e) {
            Log::warning('payment-event-log verify failed', ['error' => $e->getMessage()]);
        }
    }
}
