<?php

namespace Tests\Feature;

use App\Models\OtpCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * OTP authentication flow: request / verify code, token issuance, session
 * endpoints. The SMS send is simulated by putting the app in local mode with
 * OTP_TEST_MODE=true (AuthController::send logs the code instead of calling
 * Twilio); without it the provider-missing 503 path is exercised.
 */
class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create(array_merge([
            'id' => (string) Str::uuid(),
            'name' => 'کاربر تست',
            'phone' => '0912'.random_int(1000000, 9999999),
        ], $overrides));
    }

    private function otp(string $phone, string $code = '12345', int $attempts = 0): OtpCode
    {
        return OtpCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'attempts' => $attempts,
            'expires_at' => now()->addMinutes(5),
        ]);
    }

    private function simulateSms(bool $enabled): void
    {
        $this->app->detectEnvironment(fn () => $enabled ? 'local' : 'testing');
        putenv('OTP_TEST_MODE='.($enabled ? 'true' : 'false'));
    }

    /* ─────────────────────────── OTP request ─────────────────────────── */

    public function test_request_otp_rejects_invalid_phone(): void
    {
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '12345'])
            ->assertStatus(422);

        $this->assertSame(0, OtpCode::count());
    }

    public function test_request_otp_generates_normalized_code(): void
    {
        $this->simulateSms(true);

        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09123456789'])
            ->assertOk()
            ->assertJson(['ok' => true, 'expiresIn' => 300]);

        $otp = OtpCode::first();
        $this->assertNotNull($otp);
        $this->assertSame('+989123456789', $otp->phone);
        $this->assertNull($otp->used_at);
        $this->assertFalse(Hash::needsRehash($otp->code_hash));
    }

    public function test_request_otp_invalidates_previous_unused_codes(): void
    {
        $this->simulateSms(true);

        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09123456789'])->assertOk();
        $first = OtpCode::first();
        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09123456789'])->assertOk();

        $this->assertSame(2, OtpCode::count());
        $this->assertNotNull($first->fresh()->used_at); // previous code invalidated
    }

    public function test_request_otp_returns_503_when_sms_provider_missing(): void
    {
        $this->simulateSms(false);

        $this->postJson('/api/v1/auth/otp/request', ['phone' => '09123456789'])
            ->assertStatus(503)
            ->assertJson(['message' => 'ارسال پیامک انجام نشد. لطفاً بعداً دوباره تلاش کنید.']);

        // The code is still persisted so a retry can verify it.
        $this->assertSame(1, OtpCode::count());
    }

    /* ─────────────────────────── OTP verify ──────────────────────────── */

    public function test_verify_otp_creates_user_and_returns_token(): void
    {
        $this->otp('+989123456789', '54321');

        $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '09123456789',
            'code' => '54321',
            'name' => 'علی رضایی',
        ])->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'phone', 'role', 'xp']]);

        $user = User::first();
        $this->assertSame('علی رضایی', $user->name);
        $this->assertSame('+989123456789', $user->phone);
        $this->assertNotNull(OtpCode::first()->used_at);
    }

    public function test_verify_otp_without_name_uses_default(): void
    {
        $this->otp('+989123456789');

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09123456789', 'code' => '12345'])
            ->assertOk();

        $this->assertSame('کاربر', User::first()->name);
    }

    public function test_verify_otp_wrong_code_increments_attempts(): void
    {
        $otp = $this->otp('+989123456789');

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09123456789', 'code' => '99999'])
            ->assertStatus(422);

        $this->assertSame(1, $otp->fresh()->attempts);
        $this->assertSame(0, User::count());
    }

    public function test_verify_otp_rejects_when_attempts_exhausted(): void
    {
        $this->otp('+989123456789', '12345', 5);

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09123456789', 'code' => '12345'])
            ->assertStatus(422);

        $this->assertSame(0, User::count());
    }

    public function test_verify_otp_rejects_blocked_user(): void
    {
        $this->otp('+989123456789');
        $this->user(['phone' => '+989123456789', 'status' => 'blocked']);

        $this->postJson('/api/v1/auth/otp/verify', ['phone' => '09123456789', 'code' => '12345'])
            ->assertStatus(403)
            ->assertJson(['message' => 'حساب کاربری شما مسدود است.']);
    }

    public function test_verify_otp_updates_name_on_existing_user(): void
    {
        $this->otp('+989123456789');
        $user = $this->user(['phone' => '+989123456789']);

        $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '09123456789',
            'code' => '12345',
            'name' => 'نام بهروزشده',
        ])->assertOk();

        $this->assertSame('نام بهروزشده', $user->fresh()->name);
    }

    /* ──────────────────────── session endpoints ──────────────────────── */

    public function test_me_returns_authenticated_user(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_logout_revokes_token(): void
    {
        $user = $this->user();
        Sanctum::actingAs($user);

        $this->deleteJson('/api/v1/auth/session')->assertOk()->assertJson(['ok' => true]);

        $this->assertSame(0, $user->tokens()->count());
    }
}
