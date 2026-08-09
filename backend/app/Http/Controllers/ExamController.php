<?php

namespace App\Http\Controllers;

use App\Models\Chapter;
use App\Models\DiscountRule;
use App\Models\Exam;
use App\Models\Purchase;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Chapter exams. The client only sends the answer indices — the score, pass
 * state and awarded performance discount are all computed server-side from the
 * DB question bank, so a forged score can never unlock a discount. After every
 * exam the result notification (including the next-chapter discount, when won)
 * goes through NotificationService → in-app row + optional SMS.
 */
class ExamController extends Controller
{
    /** Grade a chapter exam and record the attempt. */
    public function submit(Request $request, Chapter $chapter): JsonResponse
    {
        // Paid chapters require a paid purchase (or an admin). The exam is
        // part of the paid content, so access is enforced server-side.
        if (! $chapter->free && $request->user()->role !== 'admin') {
            $owns = Purchase::where('user_id', $request->user()->id)
                ->where('chapter_id', $chapter->id)
                ->where('status', 'paid')->exists();
            abort_unless($owns, 403);
        }

        $data = $request->validate([
            'answers' => ['required', 'array'],
            'answers.*' => ['nullable', 'integer', 'min:0', 'max:8'],
        ]);

        $exam = Exam::where('chapter_id', $chapter->id)->first();
        abort_unless($exam, 404, 'آزمون این فصل هنوز تعریف نشده است.');

        $questions = $exam->questions()->get();
        $answers = array_values($data['answers']);
        $correct = 0;
        foreach ($questions as $index => $question) {
            if (isset($answers[$index]) && (int) $answers[$index] === (int) $question->correct) {
                $correct++;
            }
        }
        $total = $questions->count();
        $score = $total > 0 ? (int) round($correct / $total * 100) : 0;
        $passed = $score >= $exam->pass_score;

        // Performance discount applies only when passed AND a next chapter exists.
        $next = Chapter::where('index', $chapter->index + 1)->first();
        $awardedDiscount = $passed && $next ? (DiscountRule::first()?->percentFor($score) ?? 0) : 0;

        $attempt = DB::transaction(function () use ($request, $chapter, $score, $correct, $total, $passed, $awardedDiscount) {
            $attempt = DB::table('exam_attempts')->insertGetId([
                'user_id' => $request->user()->id,
                'chapter_id' => $chapter->id,
                'score' => $score,
                'correct' => $correct,
                'wrong' => $total - $correct,
                'passed' => $passed,
                'topic_analysis' => json_encode([]),
                'awarded_discount' => $awardedDiscount,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $request->user()->increment('xp', $score);
            $request->user()->increment('points', $score);

            return $attempt;
        });

        $this->notifyResult($request->user(), $chapter, $next, $score, $passed, $awardedDiscount, (int) $exam->pass_score);

        return response()->json([
            'attemptId' => $attempt,
            'score' => $score,
            'correct' => $correct,
            'wrong' => $total - $correct,
            'passed' => $passed,
            'awardedDiscount' => $awardedDiscount,
            'discountChapterId' => $next?->id,
        ]);
    }

    /**
     * Result notification (in-app + SMS via NotificationService). The discount
     * message is only sent when a discount was actually awarded — the SMS text
     * carries the same next-chapter discount so the user knows it right away.
     */
    private function notifyResult($user, Chapter $chapter, ?Chapter $next, int $score, bool $passed, int $awardedDiscount, int $passScore): void
    {
        $link = $awardedDiscount && $next ? '/chapters/'.$next->id : '/chapters/'.$chapter->id.'/exam/result';
        if ($awardedDiscount > 0 && $next) {
            app(NotificationService::class)->send(
                $user,
                'discount',
                'تخفیف عملکردی فعال شد',
                'نمره شما در آزمون «'.$chapter->title.'» '.$score.' از ۱۰۰ بود و تخفیف ٪'.$awardedDiscount.' برای فصل بعد ('.$next->title.') فعال شد. مبارکت باشد!',
                ['link' => $link]
            );

            return;
        }

        // No discount — still a plain result notice (never claims a discount).
        app(NotificationService::class)->send(
            $user,
            'exam',
            'نتیجه آزمون '.$chapter->title,
            $passed
                ? 'نمره شما: '.$score.' از ۱۰۰ — قبول شدید. 🎉'
                : 'نمره شما: '.$score.' از ۱۰۰ — برای قبولی به '.$passScore.' نیاز است. دوباره تلاش کنید.',
            ['link' => $link]
        );
    }
}
