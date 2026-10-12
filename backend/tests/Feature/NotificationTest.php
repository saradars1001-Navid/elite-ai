<?php

namespace Tests\Feature;

use App\Models\Chapter;
use App\Models\Purchase;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\IDPayGateway;
use App\Services\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * In-app notifications: a successful payment (webhook) must create a
 * user_notifications row, and the user API (list / mark-read / delete) must
 * expose it with a correct unread counter.
 */
class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '0912'.str_pad((string) mt_rand(0, 99999999), 8, '0', STR_PAD_LEFT),
            'wallet_balance' => 0,
        ]);
    }

    private function pendingPurchase(User $user, string $chapterId = 'ch-notif'): Purchase
    {
        Chapter::firstOrCreate(['id' => $chapterId], [
            'index' => 1,
            'title' => 'فصل پرامپت‌نویسی',
            'price' => 50000,
            'free' => false,
        ]);

        return Purchase::create([
            'checkout_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'chapter_id' => $chapterId,
            'price' => 50000,
            'base_price' => 50000,
            'receipt_id' => 'TMP-'.Str::upper(Str::random(6)),
            'status' => 'pending',
        ]);
    }

    /** A valid IDPay webhook — payment confirmed server-to-server. */
    private function confirmPayment(Purchase $purchase): void
    {
        $this->app->instance(PaymentGateway::class, new IDPayGateway);
        Http::fake([
            'api.idpay.ir/*' => Http::response(['status' => 100, 'track_id' => 'TRACK-N-1'], 200),
        ]);
        // The order was opened with this payment id at checkout.
        $purchase->update(['gateway_ref' => 'pay-notif-1']);

        $this->postJson('/api/v1/payment/webhook', [
            'id' => 'pay-notif-1',
            'order_id' => (string) $purchase->id,
            'track_id' => 'TRACK-N-1',
            'status' => 100,
        ])->assertOk();
    }

    public function test_successful_payment_creates_in_app_notification(): void
    {
        $user = $this->user();
        $purchase = $this->pendingPurchase($user);

        $this->confirmPayment($purchase);

        $notification = UserNotification::where('user_id', $user->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('payment', $notification->type);
        $this->assertSame('پرداخت موفق', $notification->title);
        $this->assertStringContainsString('پرامپت‌نویسی', (string) $notification->body);
        $this->assertSame('/chapter/ch-notif', $notification->data['link'] ?? null);
        $this->assertNull($notification->read_at);
    }

    public function test_notifications_api_lists_and_marks_read(): void
    {
        $user = $this->user();
        $purchase = $this->pendingPurchase($user);
        $this->confirmPayment($purchase);

        Sanctum::actingAs($user);

        // List — one unread notification.
        $this->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonPath('unread', 1)
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.type', 'payment')
            ->assertJsonPath('notifications.0.read', false);

        // Mark read — unread counter drops.
        $id = UserNotification::first()->id;
        $this->patchJson("/api/v1/notifications/{$id}/read")
            ->assertOk()
            ->assertJsonPath('notification.read', true);

        $this->getJson('/api/v1/notifications')->assertJsonPath('unread', 0);

        // Read-all on a fresh notification.
        $purchase2 = $this->pendingPurchase($user, 'ch-notif-2');
        $this->confirmPayment($purchase2);
        $this->getJson('/api/v1/notifications')->assertJsonPath('unread', 1);
        $this->patchJson('/api/v1/notifications/read-all')->assertOk();
        $this->getJson('/api/v1/notifications')->assertJsonPath('unread', 0);
    }

    public function test_user_cannot_touch_another_users_notification(): void
    {
        $owner = $this->user();
        $purchase = $this->pendingPurchase($owner);
        $this->confirmPayment($purchase);

        $other = $this->user();
        Sanctum::actingAs($other);

        $id = UserNotification::first()->id;
        $this->patchJson("/api/v1/notifications/{$id}/read")->assertForbidden();
        $this->deleteJson("/api/v1/notifications/{$id}")->assertForbidden();
        $this->assertNull(UserNotification::find($id)->read_at);
        $this->assertSame(1, UserNotification::count());
    }

    public function test_delete_removes_notification(): void
    {
        $user = $this->user();
        $purchase = $this->pendingPurchase($user);
        $this->confirmPayment($purchase);

        Sanctum::actingAs($user);
        $id = UserNotification::first()->id;

        $this->deleteJson("/api/v1/notifications/{$id}")->assertOk();
        $this->assertSame(0, UserNotification::count());
    }
}
