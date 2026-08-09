<?php

namespace App\Http\Controllers;

use App\Models\AiTool;
use App\Models\Chapter;
use App\Models\Coupon;
use App\Models\DiscountRule;
use App\Models\PaymentEvent;
use App\Models\Quiz;
use App\Models\ShortVideo;
use App\Models\TrendingPrompt;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function users(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        return response()->json(['users' => User::when($q, fn ($x) => $x->where(fn ($w) => $w->where('name', 'like', "%{$q}%")->orWhere('phone', 'like', "%{$q}%")))->latest()->paginate(50)]);
    }

    public function createUser(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'phone' => ['required', 'string', 'max:32'], 'role' => ['nullable', 'in:user,admin,instructor']]);
        $user = User::create(['id' => (string) Str::uuid(), 'name' => $data['name'], 'phone' => $data['phone'], 'role' => $data['role'] ?? 'user']);

        return response()->json(['user' => $user], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['name' => ['sometimes', 'string', 'max:120'], 'role' => ['sometimes', 'in:user,admin,instructor'], 'status' => ['sometimes', 'in:active,blocked']]);
        $user->update($data);

        return response()->json(['user' => $user]);
    }

    public function paymentEvents(Request $request): JsonResponse
    {
        $status = (string) $request->query('status', '');
        $source = (string) $request->query('source', '');
        $events = PaymentEvent::when($status, fn ($q) => $q->where('status', $status))
            ->when($source, fn ($q) => $q->where('source', $source))
            ->latest()->limit(100)->get()
            ->map(fn (PaymentEvent $e) => [
                'id' => $e->id,
                'source' => $e->source,
                'gateway' => $e->gateway,
                'type' => $e->type,
                'referenceType' => $e->reference_type,
                'referenceId' => $e->reference_id,
                'status' => $e->status,
                'payload' => $e->payload,
                'verifyResult' => $e->verify_result,
                'error' => $e->error,
                'createdAt' => $e->created_at?->toIso8601String(),
            ]);

        return response()->json(['events' => $events]);
    }

    public function resource(Request $request, string $resource): JsonResponse
    {
        $model = match ($resource) {
            'chapters' => Chapter::class, 'quizzes' => Quiz::class, 'tools' => AiTool::class, 'videos' => ShortVideo::class, 'prompts' => TrendingPrompt::class, default => null
        };
        abort_unless($model, 404);
        $data = $request->validate(['id' => ['required', 'string']]);
        $item = $model::updateOrCreate(['id' => $data['id']], $this->normalize($resource, $request->except(['_token', 'id'])));

        return response()->json(['item' => $item]);
    }

    public function destroy(string $resource, string $id): JsonResponse
    {
        $model = match ($resource) {
            'chapters' => Chapter::class, 'quizzes' => Quiz::class, 'tools' => AiTool::class, 'videos' => ShortVideo::class, 'prompts' => TrendingPrompt::class, default => null
        };
        abort_unless($model, 404);
        $model::whereKey($id)->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Simulate the final chapter price for a hypothetical exam score + coupon
     * (admin preview). Mirrors CheckoutController::price but uses the score
     * entered in the form instead of the buyer's real exam result, and never
     * creates a purchase.
     */
    public function pricingPreview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'chapterId' => ['required', 'string', 'exists:chapters,id'],
            'examScore' => ['nullable', 'integer', 'min:0', 'max:100'],
            'couponCode' => ['nullable', 'string', 'max:40'],
        ]);
        $chapter = Chapter::findOrFail($data['chapterId']);
        $rule = DiscountRule::first();
        $basePrice = max(0, (int) $chapter->price);

        // The performance discount is only granted against the previous chapter.
        $eligible = $chapter->index > 1 && Chapter::where('index', $chapter->index - 1)->exists();
        $performance = 0;
        if ($eligible && isset($data['examScore'])) {
            $performance = $rule?->percentFor((int) $data['examScore']) ?? 0;
        }

        $coupon = null;
        $couponPercent = 0;
        $couponCode = $data['couponCode'] ?? null;
        if ($couponCode) {
            $coupon = Coupon::where('code', strtoupper(trim($couponCode)))->first();
            if ($coupon && $coupon->isValid()) {
                $couponPercent = (int) $coupon->percent;
            }
        }

        $totalPercent = min(100, $performance + $couponPercent);
        $finalPrice = (int) round($basePrice * (100 - $totalPercent) / 100);
        $labels = [];
        if ($performance > 0) {
            $labels[] = "٪{$performance} عملکردی";
        }
        if ($couponPercent > 0) {
            $labels[] = "٪{$couponPercent} کد {$couponCode}";
        }

        return response()->json([
            'chapter' => ['id' => $chapter->id, 'title' => $chapter->title, 'index' => (int) $chapter->index, 'free' => (bool) $chapter->free],
            'basePrice' => $basePrice,
            'performanceEligible' => $eligible,
            'performancePercent' => $performance,
            'couponPercent' => $couponPercent,
            'couponValid' => (bool) ($coupon && $coupon->isValid()),
            'couponMessage' => $couponCode && ! ($coupon && $coupon->isValid()) ? 'کد تخفیف نامعتبر، منقضی یا مصرف‌شده است.' : null,
            'totalPercent' => $totalPercent,
            'finalPrice' => $finalPrice,
            'discountLabel' => implode(' + ', $labels),
            'tiers' => $rule ? [
                ['label' => 'عالی', 'min' => (int) $rule->high_min, 'percent' => (int) $rule->high_percent],
                ['label' => 'خوب', 'min' => (int) $rule->mid_min, 'percent' => (int) $rule->mid_percent],
                ['label' => 'قابل قبول', 'min' => (int) $rule->low_min, 'percent' => (int) $rule->low_percent],
            ] : [],
        ]);
    }

    /**
     * Send a public/group announcement: creates one in-app notification row per
     * active non-admin user through NotificationService::broadcast, scoped by
     * the chosen audience (all users, chapter buyers, active in last 30 days,
     * users without a purchase). Returns the real recipient count.
     */
    public function sendNotification(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'in:chapter,lesson,quiz,discount,exam,badge,community,support,payment'],
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:2000'],
            'link' => ['nullable', 'string', 'max:500'],
            'audience' => ['nullable', 'string', 'in:all,chapter-buyers,active-30d,no-purchase'],
            'chapterId' => ['nullable', 'string', 'exists:chapters,id'],
        ]);

        $scope = null;
        switch ($data['audience'] ?? 'all') {
            case 'chapter-buyers':
                abort_unless(isset($data['chapterId']), 422, 'برای مخاطب «خریداران فصل» شناسه فصل الزامی است.');
                $scope = fn ($query) => $query->whereExists(function ($sub) use ($data) {
                    $sub->selectRaw('1')->from('purchases')
                        ->whereColumn('purchases.user_id', 'users.id')
                        ->where('purchases.chapter_id', $data['chapterId'])
                        ->where('purchases.status', 'paid');
                });
                break;
            case 'active-30d':
                $scope = fn ($query) => $query->where('last_active_date', '>=', now()->subDays(30)->toDateString());
                break;
            case 'no-purchase':
                $scope = fn ($query) => $query->whereNotExists(function ($sub) {
                    $sub->selectRaw('1')->from('purchases')
                        ->whereColumn('purchases.user_id', 'users.id')
                        ->where('purchases.status', 'paid');
                });
                break;
        }

        $recipients = app(NotificationService::class)->broadcast(
            $data['type'],
            $data['title'],
            $data['body'],
            ($data['link'] ?? null) ? ['link' => $data['link']] : [],
            $scope
        );

        return response()->json(['ok' => true, 'recipients' => $recipients]);
    }

    private function normalize(string $resource, array $payload): array
    {
        return match ($resource) {
            'tools' => ['name' => $payload['name'] ?? '', 'tagline' => $payload['tagline'] ?? null, 'description' => $payload['description'] ?? null, 'category' => $payload['category'] ?? 'عمومی', 'use_cases' => $payload['useCases'] ?? [], 'level' => $payload['level'] ?? 'متوسط', 'pricing' => $payload['pricing'] ?? 'رایگان', 'languages' => $payload['languages'] ?? [], 'url' => $payload['url'] ?? null, 'rating' => $payload['rating'] ?? 0, 'reviews' => $payload['reviews'] ?? 0, 'related_lessons' => $payload['relatedLessons'] ?? [], 'reviewed_at' => $payload['reviewedAt'] ?? null, 'is_new' => $payload['isNew'] ?? false],
            'videos' => ['title' => $payload['title'] ?? '', 'creator' => $payload['creator'] ?? '', 'creator_role' => $payload['creatorRole'] ?? null, 'category' => $payload['category'] ?? 'عمومی', 'description' => $payload['description'] ?? null, 'video_path' => $payload['videoUrl'] ?? '', 'poster_path' => $payload['posterUrl'] ?? null, 'duration_seconds' => $payload['durationSeconds'] ?? 0, 'tags' => $payload['tags'] ?? [], 'views' => $payload['views'] ?? 0, 'likes' => $payload['likes'] ?? 0, 'status' => $payload['status'] ?? 'draft', 'featured' => $payload['featured'] ?? false],
            'prompts' => ['title' => $payload['title'] ?? '', 'prompt' => $payload['prompt'] ?? '', 'category' => $payload['category'] ?? 'متن', 'tool' => $payload['tool'] ?? '', 'author' => $payload['author'] ?? '', 'description' => $payload['description'] ?? null, 'tags' => $payload['tags'] ?? [], 'uses' => $payload['uses'] ?? 0, 'likes' => $payload['likes'] ?? 0, 'status' => $payload['status'] ?? 'draft', 'featured' => $payload['featured'] ?? false],
            'quizzes' => ['kind' => $payload['kind'] ?? 'category', 'title' => $payload['title'] ?? '', 'category' => $payload['category'] ?? null, 'difficulty' => $payload['difficulty'] ?? 'آسان', 'duration_seconds' => $payload['durationSeconds'] ?? 90, 'points_per_question' => $payload['pointsPerQuestion'] ?? 10, 'status' => $payload['status'] ?? 'published'],
            default => $payload,
        };
    }
}
