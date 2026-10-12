<?php

namespace App\Http\Controllers;

use App\Models\WalletTransaction;
use App\Services\NotificationService;
use App\Services\PaymentEventLogger;
use App\Services\PaymentGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WalletController extends Controller
{
    private const MIN_CHARGE = 10000;      // Toman

    private const MAX_CHARGE = 50000000;   // Toman

    public function __construct(private PaymentGateway $gateway) {}

    /** Balance + recent transaction history for the authenticated user. */
    public function index(Request $request): JsonResponse
    {
        $transactions = WalletTransaction::where('user_id', $request->user()->id)
            ->latest()->limit(50)->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'type' => $t->type,
                'amount' => (int) $t->amount,
                'balanceAfter' => (int) $t->balance_after,
                'status' => $t->status,
                'description' => $t->description,
                'createdAt' => $t->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'balance' => (int) $request->user()->wallet_balance,
            'transactions' => $transactions,
        ]);
    }

    /** Start a wallet charge: creates a pending transaction, opens the gateway. */
    public function charge(Request $request): JsonResponse
    {
        $data = $request->validate(['amount' => ['required', 'integer', 'min:'.self::MIN_CHARGE, 'max:'.self::MAX_CHARGE]]);
        $amount = (int) $data['amount'];

        $transaction = WalletTransaction::create([
            'user_id' => $request->user()->id,
            'type' => 'charge',
            'amount' => $amount,
            'balance_after' => (int) $request->user()->wallet_balance,
            'status' => 'pending',
            'description' => 'شارژ کیف پول',
        ]);

        $referenceId = 'wallet-'.$transaction->id;
        $callbackUrl = rtrim((string) config('app.url'), '/').'/api/v1/wallet/callback?tx='.$transaction->id;
        try {
            $result = $this->gateway->initiate($amount, 'شارژ کیف پول ایلیت', $callbackUrl, $referenceId);
            $transaction->update(['gateway_ref' => $result['ref']]);

            return response()->json([
                'transactionId' => $transaction->id,
                'amount' => $amount,
                'checkoutUrl' => $result['url'],
            ]);
        } catch (\Throwable $e) {
            $transaction->update(['status' => 'failed']);
            report($e);

            return response()->json(['message' => 'درگاه پرداخت در دسترس نیست. کمی بعد دوباره تلاش کنید.'], 502);
        }
    }

    /** Public gateway redirect after a charge; verify server-side, then credit the wallet. */
    public function callback(Request $request): RedirectResponse
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/').'/profile?wallet=';
        $transaction = WalletTransaction::find((int) $request->query('tx'));
        $eventId = PaymentEventLogger::start('callback', 'payment', $transaction ? 'wallet' : null, $transaction ? 'wallet-'.$transaction->id : null, $request->query());
        if (! $transaction || $transaction->status !== 'pending') {
            PaymentEventLogger::finish($eventId, 'failed', null, $transaction ? 'not_pending' : 'transaction_not_found');

            return redirect()->to($frontend.'failed');
        }

        $proof = $this->gateway->verifyFromCallback($request);
        if (! $proof['ok'] || $proof['authority'] === '') {
            $transaction->update(['status' => 'failed']);
            PaymentEventLogger::finish($eventId, 'failed', null, 'gateway_callback_rejected');

            return redirect()->to($frontend.'failed');
        }

        try {
            $verify = $this->gateway->verify($proof['authority'], (int) $transaction->amount, 'wallet-'.$transaction->id);
        } catch (\Throwable $e) {
            report($e);
            $verify = ['ok' => false];
        }
        PaymentEventLogger::verify($eventId, $verify);
        if (empty($verify['ok'])) {
            $transaction->update(['status' => 'failed']);
            PaymentEventLogger::finish($eventId, 'failed');

            return redirect()->to($frontend.'failed');
        }

        // Credit the balance inside a transaction so the ledger always balances.
        DB::transaction(function () use ($transaction, $verify) {
            $user = $transaction->user;
            $balance = (int) $user->wallet_balance + (int) $transaction->amount;
            $user->update(['wallet_balance' => $balance]);
            $transaction->update([
                'status' => 'completed',
                'balance_after' => $balance,
                'gateway_ref' => $verify['ref'] ?? $proof['ref'] ?? $transaction->gateway_ref,
            ]);
        });
        app(NotificationService::class)->send(
            $transaction->user,
            'payment',
            'کیف پول شما شارژ شد',
            number_format((int) $transaction->amount).' تومان به کیف پول شما اضافه شد.',
            ['link' => '/profile']
        );
        PaymentEventLogger::finish($eventId, 'processed');

        return redirect()->to($frontend.'success');
    }
}
