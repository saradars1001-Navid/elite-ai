import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  Share2,
  RotateCcw,
  ArrowLeft,
  Flame,
  Home,
} from "lucide-react";
import { useApp } from "../lib/store";
import type { QuizResult } from "../lib/types";
import { cls, toFa } from "../lib/utils";

type Phase = "ready" | "playing" | "done";

export default function QuizPlay() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user, submitQuiz, isDailyQuizDone, quizzes } = useApp();
  const quiz = quizzes.find((q) => q.id === quizId);

  const [phase, setPhase] = useState<Phase>("ready");
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [shared, setShared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Answers live in a ref so the timer callback always submits what was picked.
  const answersRef = useRef<number[]>([]);
  const startedAtRef = useRef(0);

  const questions = useMemo(() => (quiz ? [...quiz.questions] : []), [quiz]);

  const today = new Date().toISOString().slice(0, 10);
  const dailyDone = quiz?.kind === "daily" && isDailyQuizDone(today);

  useEffect(() => {
    if (phase !== "playing" || !quiz || !questions.length) return;
    setTimeLeft(quiz.durationSeconds);
    startedAtRef.current = Date.now();
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          void finish();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (!questions.length) return;
    // Reset everything when switching to a different quiz without unmounting.
    setIdx(0);
    setSelected(null);
    setLocked(false);
    answersRef.current = [];
    setSubmitted(false);
    setResult(null);
    setPhase("ready");
  }, [questions.length]);

  if (!quiz) {
    return <div className="container-x py-20 text-center text-muted">کوییز پیدا نشد.</div>;
  }

  async function finish() {
    if (submitted || submitting || !quiz) return;
    setSubmitted(true);
    setSubmitting(true);
    setPhase("done");
    const duration = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
    const graded = await submitQuiz(quiz.id, answersRef.current, duration);
    setResult(graded);
    setSubmitting(false);
  }

  // Picking an answer only records it: the correct answer is revealed after submit,
  // because the server grades the quiz and the answer key is not sent to the client.
  const answer = (i: number) => {
    if (locked || phase !== "playing") return;
    setSelected(i);
    const next = [...answersRef.current];
    next[idx] = i;
    answersRef.current = next;
    setLocked(true);
  };

  const next = () => {
    if (idx + 1 < questions.length) {
      setIdx((i) => i + 1);
      setSelected(null);
      setLocked(false);
    } else {
      void finish();
    }
  };

  const fmt = (s: number) => `${toFa(Math.floor(s / 60))}:${toFa(String(s % 60).padStart(2, "0"))}`;

  /* ready screen */
  if (phase === "ready") {
    return (
      <div className="container-x max-w-xl py-14">
        <div className="card overflow-hidden">
          <div className={cls("bg-grid h-2", quiz.kind === "daily" ? "bg-teal" : "bg-[#7C3AED]")} />
          <div className="space-y-5 p-7 sm:p-9">
            <span className="chip border border-sky/25 bg-sky/10 text-sky">
              {quiz.kind === "daily"
                ? "کوییز روزانه"
                : quiz.kind === "weekly"
                  ? "کوییز هفتگی"
                  : "کوییز تخصصی"}
            </span>
            <h1 className="text-2xl font-black">{quiz.title}</h1>
            <p className="text-sm leading-8 text-muted">
              {toFa(questions.length)} سؤال در {toFa(quiz.durationSeconds)} ثانیه. جواب درست و توضیح
              هر سؤال بعد از ثبت کوییز نمایش داده می‌شود. هر پاسخ درست{" "}
              {toFa(quiz.pointsPerQuestion)} امتیاز دارد؛ امتیاز فقط در اولین تلاش هر کوییز ثبت
              می‌شود.
            </p>
            {dailyDone && (
              <div className="flex items-center gap-2 rounded-lg border border-teal/25 bg-teal/10 px-4 py-3 text-sm text-teal">
                <CheckCircle2 size={16} /> کوییز امروز را قبلاً انجام داده‌اید. می‌توانید برای تمرین
                دوباره شرکت کنید.
              </div>
            )}
            {!user && (
              <div className="flex items-center gap-2 rounded-lg border border-warn/25 bg-warn/10 px-4 py-3 text-sm text-warn">
                <Flame size={16} /> برای ثبت امتیاز و زنجیره، ابتدا وارد شوید.
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setPhase("playing")} className="btn-primary btn-lg flex-1">
                شروع کوییز
              </button>
              <button onClick={() => navigate("/quiz")} className="btn-secondary btn-lg">
                بازگشت
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* playing */
  if (phase === "playing") {
    const q = questions[idx];
    const progress = ((idx + (locked ? 1 : 0)) / questions.length) * 100;
    return (
      <div className="container-x max-w-2xl py-8 sm:py-10">
        <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-line/50 bg-page/90 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">
              سؤال {toFa(idx + 1)} از {toFa(questions.length)}
            </span>
            <span
              className={cls(
                "flex items-center gap-1.5 rounded-md px-3 py-1 font-black",
                timeLeft < 10 ? "bg-danger/15 text-danger" : "bg-surface2 text-sky"
              )}
              dir="ltr"
            >
              <Clock size={14} /> {fmt(timeLeft)}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className="h-full rounded-full bg-neon transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="card p-6 sm:p-8 animate-fade-in" key={idx}>
          <p className="mb-6 text-lg font-bold leading-9">{q.text}</p>
          <div className="space-y-3">
            {q.options.map((o, i) => {
              const isPicked = locked && selected === i;
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={locked}
                  className={cls(
                    "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-right text-sm transition-all",
                    isPicked
                      ? "border-neon bg-neon/10 text-neon"
                      : locked
                        ? "border-line/40 bg-surface2/30 text-locked"
                        : "border-line/60 bg-surface2/40 text-muted hover:border-neon/40"
                  )}
                >
                  <span
                    className={cls(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                      isPicked ? "border-neon bg-neon text-page" : "border-line text-locked"
                    )}
                  >
                    {toFa(i + 1)}
                  </span>
                  <span className="leading-7">{o}</span>
                </button>
              );
            })}
          </div>

          {locked && (
            <div className="mt-5 flex flex-col gap-3 rounded-lg border border-sky/25 bg-sky/5 p-4 animate-slide-up sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                پاسخ شما ثبت شد. جواب درست در پایان کوییز نمایش داده می‌شود.
              </p>
              <button onClick={next} className="btn-primary btn-md w-full sm:w-auto">
                {idx + 1 < questions.length ? "سؤال بعدی" : "ثبت و مشاهده نتیجه"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* done */
  const correctCount = result?.correct ?? 0;
  const wrongCount = result ? questions.length - result.correct : 0;
  const score = result?.score ?? 0;
  const percentScore =
    result && result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
  const msg =
    percentScore >= 90
      ? { t: "فوق‌العاده!", d: "شما یک متخصص واقعی هوش مصنوعی هستید!" }
      : percentScore >= 70
        ? { t: "عالی بود!", d: "دانش خوبی دارید؛ با کمی تمرین به اوج می‌رسید." }
        : percentScore >= 50
          ? { t: "خوب شروع کردید!", d: "با مرور آموزش‌ها، دفعه بعد بهتر خواهید شد." }
          : { t: "نیاز به تمرین بیشتر", d: "پیشنهاد می‌کنیم درس‌های مرتبط را دوباره مرور کنید." };

  return (
    <div className="container-x max-w-xl py-12">
      <div className="card relative overflow-hidden p-8 text-center sm:p-10">
        <div className="bg-grid absolute inset-0 opacity-50" />
        <div className="absolute -top-20 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-teal/10 blur-[80px]" />
        <div className="relative">
          <span className="chip mb-4 border border-teal/25 bg-teal/10 text-teal">
            <Trophy size={14} /> کوییز به پایان رسید
          </span>
          {submitting && <p className="mt-6 text-sm text-muted">در حال ثبت نتیجه…</p>}
          {!submitting && !result && (
            <div className="mx-auto mt-6 max-w-sm rounded-lg border border-warn/25 bg-warn/10 px-4 py-3 text-sm text-warn">
              {user
                ? "نتیجه ثبت نشد. اتصال را بررسی کنید و کوییز را دوباره انجام دهید."
                : "برای ثبت امتیاز و مشاهده پاسخ‌های درست، ابتدا وارد شوید."}
            </div>
          )}
          {result && (
            <>
              <p className="text-5xl font-black text-gradient">{toFa(percentScore)}٪</p>
              <h2 className="mt-2 text-2xl font-black">{msg.t}</h2>
              <p className="mt-1 text-sm text-muted">{msg.d}</p>
            </>
          )}

          <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-3">
            <div className="rounded-lg border border-teal/25 bg-teal/5 px-3 py-3">
              <p className="text-xl font-black text-teal">{toFa(correctCount)}</p>
              <p className="text-[11px] text-muted">درست</p>
            </div>
            <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-3">
              <p className="text-xl font-black text-danger">{toFa(wrongCount)}</p>
              <p className="text-[11px] text-muted">غلط</p>
            </div>
            <div className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-3">
              <p className="text-xl font-black text-warn">{toFa(score)}</p>
              <p className="text-[11px] text-muted">امتیاز</p>
            </div>
          </div>

          {result && (
            <div className="mx-auto mt-8 space-y-3 text-right">
              <h3 className="text-sm font-black text-muted">مرور پاسخ‌ها</h3>
              {questions.map((question, i) => {
                const picked = answersRef.current[i];
                const review = result.review[i];
                const correctIdx = review?.correct ?? -1;
                const isRight = picked === correctIdx;
                return (
                  <div
                    key={question.id}
                    className="rounded-lg border border-line/60 bg-surface2/40 p-4"
                  >
                    <p className="mb-2 text-sm font-bold leading-7">
                      {toFa(i + 1)}. {question.text}
                    </p>
                    <p
                      className={cls(
                        "flex items-center gap-1.5 text-xs",
                        isRight ? "text-teal" : "text-danger"
                      )}
                    >
                      {isRight ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      پاسخ شما: {picked === undefined ? "پاسخ داده نشد" : question.options[picked]}
                    </p>
                    {!isRight && (
                      <p className="mt-1 text-xs text-teal">
                        پاسخ درست: {question.options[correctIdx]}
                      </p>
                    )}
                    {review?.explanation && (
                      <p className="mt-2 text-xs leading-6 text-muted">{review.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                const text = `در کوییز «${quiz.title}» آکادمی ایلیت: ${toFa(percentScore)}٪ درست پاسخ دادم (${toFa(correctCount)} از ${toFa(questions.length)})`;
                navigator.clipboard?.writeText(text);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
              }}
              className="btn-secondary btn-md"
            >
              <Share2 size={15} /> {shared ? "کپی شد" : "اشتراک نتیجه"}
            </button>
            <button
              onClick={() => {
                setPhase("ready");
              }}
              className="btn-ghost btn-md"
            >
              <RotateCcw size={15} /> دوباره
            </button>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3 border-t border-line/50 pt-6">
            <Link to="/quiz" className="btn-ghost btn-sm">
              <Home size={14} /> همه کوییزها
            </Link>
            <Link to="/chapters" className="btn-ghost btn-sm">
              <ArrowLeft size={14} /> مرور آموزش‌ها
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
