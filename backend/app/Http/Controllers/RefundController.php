<?php

namespace App\Http\Controllers;

use App\Models\Purchase;
use App\Services\NotificationService;
use App\Services\PurchaseRefunder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * User-requested refunds:
 *
 *  1. The buyer asks for a refund on a paid purchase (status stays paid and
 *     access remains granted while the request is pending).
 *  2. The admin reviews the pending request and either approves it (gateway
 *     refund + status → refunded) or rejects it (request is closed, purchase
 *     stays paid).
 *
 * The pending state is derived from refund_requested_at being set while
 * refund_rejected_at / refunded_at are null, so no enum alteration is needed.
 */
class RefundController extends Controller
{
    /** Buyer requests a refund for one of their own paid purchases. */
    public function request(Request $request, Purchase $purchase): JsonResponse
    {
        abort_unless($purchase->user_id === $request->user()->id, 403);

        if ($purchase->status !== 'paid') {
            return response()->json(['message' => 'فقط خرید موفق قابل درخواست بازگشت وجه است.'], 422);
        }
        if ($purchase->isRefundPending()) {
            return response()->json(['message' => 'درخواست بازگشت وجه شما در انتظار بررسی است.'], 409);
        }
        if ($purchase->refunded_at) {
            return response()->json(['message' => 'این خرید قبلاً مسترد شده است.'], 422);
        }

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $purchase->update([
            'refund_requested_at' => now(),
            'refund_rejected_at' => null,
            'refund_reason' => trim((string) ($data['reason'] ?? '')),
        ]);

        return response()->json(['ok' => true, 'purchase' => $this->shape($purchase)]);
    }

    /** Admin: list paid purchases that have a pending refund request. */
    public function index(Request $request): JsonResponse
    {
        $query = Purchase::with(['chapter:id,title,icon', 'user:id,name,phone'])
            ->whereNotNull('refund_requested_at');

        if (($request->query('status') ?? 'pending') === 'pending') {
            $query->whereNull('refunded_at')->whereNull('refund_rejected_at');
        } elseif ($request->query('status') === 'done') {
            $query->where(fn ($q) => $q->whereNotNull('refunded_at')->orWhereNotNull('refund_rejected_at'));
        }

        $items = $query->latest('refund_requested_at')->limit(100)->get()
            ->map(fn (Purchase $p) => $this->shape($p));

        return response()->json(['items' => $items]);
    }

    /**
     * Admin: approve the request. The refund itself (wallet credit, gateway refund
     * or manual record) is done by PurchaseRefunder under a row lock.
     */
    public function approve(Request $request, Purchase $purchase): JsonResponse
    {
        if (! $purchase->isRefundPending()) {
            return response()->json(['message' => 'درخواست بازگشت وجه فعالی برای این خرید وجود ندارد.'], 422);
        }
        $data = $request->validate([
            'manual' => ['sometimes', 'boolean'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $manual = (bool) ($data['manual'] ?? false);
        if ($manual && trim((string) ($data['note'] ?? '')) === '') {
            return response()->json(['message' => 'برای بازگشت دستی، یادداشت (مرجع بازگشت) الزامی است.'], 422);
        }

        $result = app(PurchaseRefunder::class)->refund($purchase, $manual, $data['note'] ?? null, $request->user()->id);
        if (! $result['ok']) {
            return response()->json(['message' => $result['message']], $result['status']);
        }

        $purchase = $result['purchase'];
        $chapterTitle = $purchase->chapter?->title ?? 'فصل آموزشی';
        app(NotificationService::class)->send(
            $purchase->user,
            'payment',
            'بازگشت وجه تأیید شد',
            'درخواست بازگشت وجه شما برای فصل «'.$chapterTitle.'» تأیید و مبلغ به شما بازگردانده شد.',
            ['link' => '/profile']
        );

        return response()->json(['ok' => true, 'purchase' => $this->shape($purchase)]);
    }

    /** Admin: reject the request — close it and keep the purchase paid. */
    public function reject(Request $request, Purchase $purchase): JsonResponse
    {
        if (! $purchase->isRefundPending()) {
            return response()->json(['message' => 'درخواست بازگشت وجه فعالی برای این خرید وجود ندارد.'], 422);
        }

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $purchase->update([
            'refund_rejected_at' => now(),
            'refund_reason' => trim((string) ($data['reason'] ?? $purchase->refund_reason)),
        ]);

        $chapterTitle = $purchase->chapter?->title ?? 'فصل آموزشی';
        app(NotificationService::class)->send(
            $purchase->user,
            'payment',
            'درخواست بازگشت وجه رد شد',
            'درخواست بازگشت وجه شما برای فصل «'.$chapterTitle.'» رد شد. در صورت نیاز با پشتیبانی تماس بگیرید.',
            ['link' => '/profile']
        );

        return response()->json(['ok' => true, 'purchase' => $this->shape($purchase)]);
    }

    private function shape(Purchase $purchase): array
    {
        return [
            'id' => $purchase->id,
            'chapterId' => $purchase->chapter_id,
            'chapterTitle' => $purchase->chapter?->title ?? '—',
            'userName' => $purchase->user?->name ?? '—',
            'userPhone' => $purchase->user?->phone ?? '—',
            'price' => (int) $purchase->price,
            'receiptId' => $purchase->receipt_id,
            'status' => $purchase->status,
            'refundStatus' => $purchase->refunded_at
                ? 'refunded'
                : ($purchase->refund_rejected_at
                    ? 'rejected'
                    : ($purchase->isRefundPending() ? 'pending' : 'none')),
            'refundReason' => $purchase->refund_reason,
            'refundRequestedAt' => $purchase->refund_requested_at?->toIso8601String(),
            'refundedAt' => $purchase->refunded_at?->toIso8601String(),
            'refundRejectedAt' => $purchase->refund_rejected_at?->toIso8601String(),
            'createdAt' => $purchase->created_at?->toIso8601String(),
        ];
    }
}
