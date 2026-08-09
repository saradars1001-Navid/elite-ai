import { useEffect, useMemo, useState } from "react";
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
  const [correctCount, setCorrectCount] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const [shared, setShared] = useState(false);

  const questions = useMemo(() => (quiz ? [...quiz.questions] : []), [quiz]);

  const today = new Date().toISOString().slice(0, 10);
  const dailyDone = quiz?.kind === "daily" && isDailyQuizDone(today);

  useEffect(() => {
    if (phase !== "playing" || !quiz || !questions.length) return;
    setTimeLeft(quiz.durationSeconds);
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          finish();
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
    setCorrectCount(0);
    setWrong([]);
    setAnswers([]);
    setPhase("ready");
    setFinished(false);
  }, [questions.length]);

  if (!quiz) {
    return <div className="container-x py-20 text-center text-muted">کوییز پیدا نشد.</div>;
  }

  function finish() {
    if (finished || !quiz) return;
    setFinished(true);
    const score = correctCount * quiz.pointsPerQuestion;
    submitQuiz(
      quiz.id,
      score,
      questions.length * quiz.pointsPerQuestion,
      answers,
      quiz.durationSeconds - timeLeft
    );
    setPhase("done");
  }

  const answer = (i: number) => {
    if (locked || phase !== "playing") return;
    setSelected(i);
    setAnswers((currentAnswers) => {
      const next = [...currentAnswers];
      next[idx] = i;
      return next;
    });
    setLocked(true);
    const q = questions[idx];
    if (i === q.correct) {
      setCorrectCount((c) => c + 1);
    } else {
      setWrong((w) => [...w, idx]);
    }
  };

  const next = () => {
    if (idx + 1 < questions.length) {
      setIdx((i) => i + 1);
      setSelected(null);
      setLocked(false);
    } else {
      finish();
    }
  };

  const fmt = (s: number) => `${toFa(Math.floor(s / 60))}:${toFa(String(s % 60).padStart(2, "0"))}`;
  const score = correctCount * quiz.pointsPerQuestion;
  const total = questions.length * quiz.pointsPerQuestion;

  /* ready screen */
  if (phase === "ready") {
    return (
      <div className="container-x max-w-xl py-14">
        <div className="card overflow-hidden">
          <div className={cls("bg-grid h-2", quiz.kind === "daily" ? "bg-teal" : "bg-[#8B5CF6]")} />
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
              {toFa(questions.length)} سؤال در {toFa(quiz.durationSeconds)} ثانیه. بعد از هر پاسخ،
              جواب درست با توضیح کوتاه نمایش داده می‌شود. هر پاسخ درست{" "}
              {toFa(quiz.pointsPerQuestion)} امتیاز دارد.
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
        <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-line/50 bg-base/90 px-4 py-3 backdrop-blur-md">
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
              const isCorrect = locked && i === q.correct;
              const isWrongPick = locked && selected === i && i !== q.correct;
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={locked}
                  className={cls(
                    "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-right text-sm transition-all",
                    isCorrect
                      ? "border-teal bg-teal/10 text-teal"
                      : isWrongPick
                        ? "border-danger bg-danger/10 text-danger"
                        : locked
                          ? "border-line/40 bg-surface2/30 text-locked"
                          : "border-line/60 bg-surface2/40 text-muted hover:border-neon/40"
                  )}
                >
                  <span
                    className={cls(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                      isCorrect
                        ? "border-teal bg-teal text-white"
                        : isWrongPick
                          ? "border-danger bg-danger text-white"
                          : "border-line text-locked"
                    )}
                  >
                    {toFa(i + 1)}
                  </span>
                  <span className="leading-7">{o}</span>
                  {isCorrect && <CheckCircle2 size={17} className="mr-auto mt-1 shrink-0" />}
                  {isWrongPick && <XCircle size={17} className="mr-auto mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>

          {locked && (
            <div className="mt-5 rounded-lg border border-sky/25 bg-sky/5 p-4 animate-slide-up">
              <p
                className={cls(
                  "mb-1 font-bold",
                  selected === q.correct ? "text-teal" : "text-danger"
                )}
              >
                {selected === q.correct ? "پاسخ درست بود! 🎉" : "پاسخ درست:"}
              </p>
              <p className="text-sm leading-7 text-muted">
                {q.options[q.correct]}. {q.explanation}
              </p>
              <button onClick={next} className="btn-primary btn-md mt-4 w-full sm:w-auto">
                {idx + 1 < questions.length ? "سؤال بعدی" : "مشاهده نتیجه"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* done */
  const percentScore = Math.round((score / total) * 100);
  const msg =
    percentScore >= 90
      ? { t: "فوق‌العاده!", d: "شما یک متخصص واقعی هوش مصنوعی هستید! 🏆" }
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
          <p className="text-5xl font-black text-gradient">{toFa(percentScore)}٪</p>
          <h2 className="mt-2 text-2xl font-black">{msg.t}</h2>
          <p className="mt-1 text-sm text-muted">{msg.d}</p>

          <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-3">
            <div className="rounded-lg border border-teal/25 bg-teal/5 px-3 py-3">
              <p className="text-xl font-black text-teal">{toFa(correctCount)}</p>
              <p className="text-[11px] text-muted">درست</p>
            </div>
            <div className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-3">
              <p className="text-xl font-black text-danger">{toFa(wrong.length)}</p>
              <p className="text-[11px] text-muted">غلط</p>
            </div>
            <div className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-3">
              <p className="text-xl font-black text-warn">{toFa(score)}</p>
              <p className="text-[11px] text-muted">امتیاز</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                const text = `در کوییز «${quiz.title}» آکادمی ایلیت: ${toFa(percentScore)}٪ درست پاسخ دادم (${toFa(correctCount)} از ${toFa(questions.length)}) 🎯`;
                navigator.clipboard?.writeText(text);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
              }}
              className="btn-secondary btn-md"
            >
              <Share2 size={15} /> {shared ? "کپی شد ✓" : "اشتراک نتیجه"}
            </button>
            <button
              onClick={() => {
                setPhase("ready");
                setFinished(false);
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
