<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /** Latest notifications for the authenticated user + unread count. */
    public function index(Request $request): JsonResponse
    {
        $items = UserNotification::where('user_id', $request->user()->id)
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (UserNotification $n) => $this->serialize($n));

        return response()->json([
            'notifications' => $items,
            'unread' => UserNotification::where('user_id', $request->user()->id)->whereNull('read_at')->count(),
        ]);
    }

    public function markRead(Request $request, UserNotification $notification): JsonResponse
    {
        abort_unless($notification->user_id === $request->user()->id, 403);
        $notification->update(['read_at' => now()]);

        return response()->json(['ok' => true, 'notification' => $this->serialize($notification->fresh())]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        UserNotification::where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, UserNotification $notification): JsonResponse
    {
        abort_unless($notification->user_id === $request->user()->id, 403);
        $notification->delete();

        return response()->json(['ok' => true]);
    }

    private function serialize(UserNotification $n): array
    {
        return [
            'id' => (string) $n->id,
            'type' => $n->type,
            'title' => $n->title,
            'body' => $n->body,
            'read' => $n->read_at !== null,
            'createdAt' => $n->created_at?->toIso8601String(),
            'link' => $n->data['link'] ?? null,
        ];
    }
}
