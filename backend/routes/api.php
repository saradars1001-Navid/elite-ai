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

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('otp/request', [AuthController::class, 'requestOtp']);
        Route::post('otp/verify', [AuthController::class, 'verifyOtp']);
    });
    Route::get('catalog', [CatalogController::class, 'index']);
    Route::get('discovery', [CatalogController::class, 'discovery']);
    Route::get('prompt-lab', [PromptLabController::class, 'index']);
    Route::get('search', [CatalogController::class, 'search']);
    Route::get('quizzes/{quiz}', [QuizController::class, 'show']);
    // Public: the payment gateway redirects the buyer here with query params;
    // verification happens server-side, then the browser is sent to the SPA.
    Route::get('payment/callback', [CheckoutController::class, 'callback']);
    // Public: wallet charge callback (gateway redirect, no bearer token).
    Route::get('wallet/callback', [WalletController::class, 'callback']);
    // Public: server-to-server gateway webhook (payment/refund notifications).
    Route::post('payment/webhook', [PaymentWebhookController::class, 'handle']);
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
        Route::post('quizzes/{quiz}/attempts', [QuizController::class, 'submit']);
        Route::post('exams/{chapter}/submit', [ExamController::class, 'submit']);
        Route::post('live-matches', [LiveMatchController::class, 'store']);
        Route::get('live-matches/lobby', [LiveMatchController::class, 'lobby']);
        Route::post('live-matches/{match}/join', [LiveMatchController::class, 'join']);
        Route::post('live-matches/{match}/start', [LiveMatchController::class, 'startMatch']);
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
