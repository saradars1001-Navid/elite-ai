<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Named rate limiters used by routes/api.php. All buckets live in the
     * default cache store (CACHE_STORE), so a cache backend is required in
     * production for them to take effect.
     */
    private function configureRateLimiting(): void
    {
        // Global API budget: authenticated traffic is bucketed per account,
        // anonymous traffic per IP.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
        });

        // OTP request: keyed by phone+IP so one phone cannot be SMS-bombed
        // and one IP cannot spray many phones without limit.
        RateLimiter::for('otp-request', function (Request $request) {
            return Limit::perMinute(5)->by('otp-req:'.$this->phoneKey($request));
        });

        // OTP verify: guessing a 5-digit code is useless at 15 tries/minute
        // (the per-code 5-attempt cap in AuthController stays as a second wall).
        RateLimiter::for('otp-verify', function (Request $request) {
            return Limit::perMinute(15)->by('otp-ver:'.$this->phoneKey($request));
        });

        // Quiz submissions: legitimate play is a few attempts per minute,
        // farming scripts hit dozens.
        RateLimiter::for('quiz-submit', function (Request $request) {
            return Limit::perMinute(30)->by('quiz:'.$request->user()?->id ?: $request->ip());
        });
    }

    private function phoneKey(Request $request): string
    {
        $phone = (string) $request->input('phone', '');

        return ($phone !== '' ? $phone : 'ip').'|'.$request->ip();
    }
}
