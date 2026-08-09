<?php

namespace App\Http\Controllers;

use App\Models\OtpCode;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Twilio\Rest\Client;

class AuthController extends Controller
{
    public function requestOtp(Request $request): JsonResponse
    {
        $data = $request->validate(['phone' => ['required', 'string', 'regex:/^(?:\+98|0098|98|0)?9\d{9}$/']]);
        $phone = $this->normalize($data['phone']);
        $length = (int) env('OTP_LENGTH', 5);
        $min = 10 ** ($length - 1);
        $max = (10 ** $length) - 1;
        $code = (string) random_int($min, $max);
        OtpCode::where('phone', $phone)->whereNull('used_at')->update(['used_at' => now()]);
        OtpCode::create(['phone' => $phone, 'code_hash' => Hash::make($code), 'expires_at' => now()->addMinutes((int) env('OTP_TTL_MINUTES', 5))]);
        try {
            $this->send($phone, $code);
        } catch (\Throwable $e) {
            Log::warning('OTP send failed', ['phone' => $phone, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'ارسال پیامک انجام نشد. لطفاً بعداً دوباره تلاش کنید.'], 503);
        }

        return response()->json(['ok' => true, 'expiresIn' => (int) env('OTP_TTL_MINUTES', 5) * 60]);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate(['phone' => ['required', 'string'], 'code' => ['required', 'digits:5'], 'name' => ['nullable', 'string', 'max:120']]);
        $phone = $this->normalize($data['phone']);
        $otp = OtpCode::where('phone', $phone)->whereNull('used_at')->latest('created_at')->first();
        if (! $otp || $otp->attempts >= 5 || ! $otp->matches($data['code'])) {
            if ($otp) {
                $otp->increment('attempts');
            }

            return response()->json(['message' => 'کد تأیید صحیح نیست یا منقضی شده است.'], 422);
        }
        $otp->update(['used_at' => now()]);
        $name = trim($data['name'] ?? '');
        $user = User::firstOrCreate(['phone' => $phone], ['id' => (string) Str::uuid(), 'name' => $name ?: 'کاربر']);
        if ($name !== '') {
            $user->update(['name' => $name]);
        }
        // Reload DB defaults (role=user, status=active) — a freshly created
        // model only carries the attributes passed to firstOrCreate, and
        // without this every new login would be treated as a blocked user.
        $user->refresh();
        if ($user->status !== 'active') {
            return response()->json(['message' => 'حساب کاربری شما مسدود است.'], 403);
        }
        $token = $user->createToken('elite-ai-web')->plainTextToken;

        return response()->json(['token' => $token, 'user' => $user->only(['id', 'name', 'phone', 'role', 'points', 'xp', 'streak_days', 'last_active_date'])]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    private function normalize(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '0098')) {
            $digits = substr($digits, 2);
        }
        if (str_starts_with($digits, '98')) {
            return '+'.$digits;
        }
        if (str_starts_with($digits, '0')) {
            return '+98'.substr($digits, 1);
        }

        return '+98'.$digits;
    }

    private function send(string $phone, string $code): void
    {
        if (app()->environment('local') && filter_var(env('OTP_TEST_MODE', false), FILTER_VALIDATE_BOOL)) {
            Log::info('Elite AI OTP generated', ['phone' => $phone, 'code' => $code]);

            return;
        }
        if (! env('TWILIO_ACCOUNT_SID') || ! env('TWILIO_AUTH_TOKEN') || ! env('TWILIO_FROM')) {
            throw new \RuntimeException('OTP provider is not configured.');
        }
        $client = new Client(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN'));
        $client->messages->create($phone, ['from' => env('TWILIO_FROM'), 'body' => "کد ورود آکادمی ایلیت: {$code}"]);
    }
}
