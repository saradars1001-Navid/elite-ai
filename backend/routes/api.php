<?php

use App\Http\Controllers\AccessController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\CheckoutController;
use App\Http\Controllers\CommunityController;
use App\Http\Controllers\ExamController;
use App\Http\Controllers\LiveMatchController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PaymentWebhookController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PromptLabController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\RefundController;
use App\Http\Controllers\StatsController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WalletController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

// Payment gateway endpoints are intentionally NOT throttled: gateways retry
// webhook deliveries and redirect buyers around without bearer tokens, and a
// 429 on these would break payment verification.
Route::prefix('v1')->group(function () {
    Route::get('payment/callback', [CheckoutController::class, 'callback']);
    Route::get('wallet/callback', [WalletController::class, 'callback']);
    Route::post('payment/webhook', [PaymentWebhookController::class, 'handle']);
});

Route::prefix('v1')->middleware('throttle:api')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('otp/request', [AuthController::class, 'requestOtp'])->middleware('throttle:otp-request');
        Route::post('otp/verify', [AuthController::class, 'verifyOtp'])->middleware('throttle:otp-verify');
    });
    Route::get('catalog', [CatalogController::class, 'index']);
    Route::get('discovery', [CatalogController::class, 'discovery']);
    Route::get('prompt-lab', [PromptLabController::class, 'index']);
    Route::get('search', [CatalogController::class, 'search']);
    Route::get('quizzes/{quiz}', [QuizController::class, 'show']);
    Route::get('quizzes/{quiz}/leaderboard', [QuizController::class, 'leaderboard']);
    Route::get('leaderboard', [UserController::class, 'leaderboard']);
    Route::get('community/posts', [CommunityController::class, 'index']);
    Route::get('community/posts/{post}', [CommunityController::class, 'show']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::delete('auth/session', [AuthController::class, 'logout']);
        Route::get('users/search', [UserController::class, 'search']);
        Route::get('access', [AccessController::class, 'index']);
        Route::post('checkout', [CheckoutController::class, 'create']);
        Route::get('checkout/{purchase}', [CheckoutController::class, 'status']);
        Route::post('checkout/{purchase}/refund', [CheckoutController::class, 'refund']);
        Route::post('checkout/{purchase}/refund-request', [RefundController::class, 'request']);
        Route::get('wallet', [WalletController::class, 'index']);
        Route::post('wallet/charge', [WalletController::class, 'charge']);
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::patch('notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
        Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);
        Route::patch('profile', [ProfileController::class, 'update']);
        Route::post('quizzes/{quiz}/attempts', [QuizController::class, 'submit'])->middleware('throttle:quiz-submit');
        Route::post('exams/{chapter}/submit', [ExamController::class, 'submit']);
        Route::post('live-matches', [LiveMatchController::class, 'store']);
        Route::get('live-matches/lobby', [LiveMatchController::class, 'lobby']);
        Route::post('live-matches/{match}/join', [LiveMatchController::class, 'join']);
        Route::post('live-matches/{match}/start', [LiveMatchController::class, 'startMatch']);
        Route::post('live-matches/{match}/rematch', [LiveMatchController::class, 'rematch']);
        Route::get('live-matches/{match}', [LiveMatchController::class, 'state']);
        Route::post('live-matches/{match}/answer', [LiveMatchController::class, 'answer']);
        Route::post('prompt-lab/attempts', [PromptLabController::class, 'submit']);
        Route::post('community/posts', [CommunityController::class, 'store']);

        Route::prefix('admin')->middleware(EnsureAdmin::class)->group(function () {
            Route::get('stats', [StatsController::class, 'index']);
            Route::get('payment-events', [AdminController::class, 'paymentEvents']);
            Route::post('notifications', [AdminController::class, 'sendNotification']);
            Route::get('refunds', [RefundController::class, 'index']);
            Route::post('refunds/{purchase}/approve', [RefundController::class, 'approve']);
            Route::post('refunds/{purchase}/reject', [RefundController::class, 'reject']);
            Route::post('pricing/preview', [AdminController::class, 'pricingPreview']);
            Route::get('users', [AdminController::class, 'users']);
            Route::post('users', [AdminController::class, 'createUser']);
            Route::patch('users/{user}', [AdminController::class, 'updateUser']);
            Route::post('resources/{resource}', [AdminController::class, 'resource']);
            Route::delete('resources/{resource}/{id}', [AdminController::class, 'destroy']);
        });
    });
});
