import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Clock, Lock, AlertTriangle, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useApp } from "../lib/store";
import { cls, toFa } from "../lib/utils";
import { Modal, Banner } from "../components/ui";

export default function Exam() {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const { hasAccess, submitExam, state, chapters } = useApp();
  const ch = chapters.find((c) => c.id === chapterId);

  const [answers, setAnswers] = useState<(number | null)[]>(
    () => ch?.exam.questions.map(() => null) ?? []
  );
  const [step, setStep] = useState(0);
  const [remaining, setRemaining] = useState(() => (ch?.exam.durationMinutes ?? 20) * 60);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const submittedRef = useRef(false);

  useEffect(() => {
    if (!started || submittedRef.current) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          finish();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started]);

  if (!ch) {
    return <div className="container-x py-20 text-center text-muted">آزمون پیدا نشد.</div>;
  }

  const owned = ch.free || hasAccess(ch.id);
  const qs = ch.exam.questions;
  const answered = answers.filter((a) => a !== null).length;

  function finish() {
    if (submittedRef.current || !ch) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setTimeout(() => {
      // The server grades the exam; the result page reads the stored attempt.
      submitExam(ch.exam.id, answers)
        .then((attempt) =>
          navigate(`/chapters/${ch.id}/exam/result/${attempt.id}`, { replace: true })
        )
        .catch((err: unknown) => {
          submittedRef.current = false;
          setSubmitting(false);
          setSubmitError(err instanceof Error ? err.message : "ثبت آزمون انجام نشد.");
        });
    }, 700);
  }

  if (!owned) {
    return (
      <div className="container-x max-w-xl py-16">
        <div className="card flex flex-col items-center gap-4 p-10 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface2 text-locked">
            <Lock size={26} />
          </span>
          <h2 className="text-xl font-black">آزمون این فصل قفل است</h2>
          <p className="text-sm leading-8 text-muted">
            برای شرکت در آزمون پایان فصل، ابتدا دسترسی فصل را خریداری کنید.
          </p>
          <button onClick={() => navigate(`/checkout/${ch.id}`)} className="btn-primary btn-md">
            خرید این فصل
          </button>
        </div>
      </div>
    );
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${toFa(m)}:${toFa(String(sec).padStart(2, "0"))}`;
  };

  const q = qs[step];

  // intro screen
  if (!started) {
    return (
      <div className="container-x max-w-2xl py-14">
        <div className="card overflow-hidden">
          <div className="bg-grid h-2 bg-navy" />
          <div className="space-y-5 p-7 sm:p-10">
            <span className="chip border border-sky/25 bg-sky/10 text-sky">
              آزمون پایان فصل {toFa(ch.index)}
            </span>
            <h1 className="text-2xl font-black">{ch.exam.title}</h1>
            <p className="text-sm leading-8 text-muted">
              {toFa(qs.length)} سؤال در {toFa(ch.exam.durationMinutes)} دقیقه. حداقل نمره قبولی{" "}
              {toFa(ch.exam.passScore)} از ۱۰۰. پاسخ‌ها به‌صورت موقت ذخیره می‌شوند و فقط با تأیید
              نهایی ثبت می‌شوند. امکان ارسال مجدد در همین نوبت وجود ندارد.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { v: toFa(qs.length), l: "سؤال" },
                { v: toFa(ch.exam.durationMinutes) + " دقیقه", l: "زمان" },
                { v: toFa(ch.exam.passScore) + "٪", l: "حداقل قبولی" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border border-line/60 bg-surface2/50 py-3.5">
                  <p className="text-lg font-black text-sky">{s.v}</p>
                  <p className="text-xs text-muted">{s.l}</p>
                </div>
              ))}
            </div>
            {state.examAttempts.some((a) => a.chapterId === ch.id) && (
              <Banner
                kind="info"
                title="شرکت مجدد در آزمون"
                text="طبق قوانین پلتفرم، شرکت مجدد در آزمون تا ۲۴ ساعت پس از نوبت قبلی مجاز نیست؛ بهترین نمره شما ملاک تخفیف خواهد بود."
              />
            )}
            <button onClick={() => setStarted(true)} className="btn-primary btn-lg w-full">
              شروع آزمون
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x max-w-3xl py-8 sm:py-10">
      {/* timer + progress */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-line/50 bg-page/90 px-4 py-3 backdrop-blur-md sm:top-16">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock size={16} className={remaining < 60 ? "text-danger" : "text-sky"} />
            <span
              className={cls("font-black", remaining < 60 ? "text-danger" : "text-text")}
              dir="ltr"
            >
              {fmt(remaining)}
            </span>
          </div>
          <span className="text-xs text-muted">
            پاسخ‌داده‌شده: <b className="text-sky">{toFa(answered)}</b> از {toFa(qs.length)}
          </span>
          <button onClick={() => setConfirmOpen(true)} className="btn-primary btn-sm">
            <Send size={13} /> پایان و ثبت
          </button>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {qs.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`سؤال ${i + 1}`}
              className={cls(
                "h-1.5 flex-1 rounded-full transition-colors",
                i === step ? "bg-neon" : answers[i] !== null ? "bg-teal" : "bg-line"
              )}
            />
          ))}
        </div>
      </div>

      {/* question */}
      <div className="card p-6 sm:p-8 animate-fade-in" key={step}>
        <div className="mb-2 flex items-center justify-between">
          <span className="chip border border-sky/25 bg-sky/10 text-sky">
            سؤال {toFa(step + 1)} از {toFa(qs.length)}
          </span>
          <span className="chip border border-line bg-surface2 text-muted">{q.topic}</span>
        </div>
        <h2 className="mb-6 text-lg font-bold leading-9 sm:text-xl">{q.text}</h2>
        <div className="space-y-3">
          {q.options.map((o, i) => (
            <button
              key={i}
              onClick={() => setAnswers((cur) => cur.map((a, ai) => (ai === step ? i : a)))}
              className={cls(
                "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-right text-sm transition-colors",
                answers[step] === i
                  ? "border-neon bg-neon/10 text-text shadow-[inset_0_0_0_1px_rgba(47,140,255,0.4)]"
                  : "border-line/60 bg-surface2/40 text-muted hover:border-neon/30"
              )}
            >
              <span
                className={cls(
                  "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  answers[step] === i ? "border-neon bg-neon text-white" : "border-line text-locked"
                )}
              >
                {toFa(i + 1)}
              </span>
              <span className="leading-7">{o}</span>
            </button>
          ))}
        </div>
      </div>

      {/* nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="btn-secondary btn-md"
        >
          <ChevronRight size={16} /> قبلی
        </button>
        {step < qs.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} className="btn-primary btn-md">
            بعدی <ChevronLeft size={16} />
          </button>
        ) : (
          <button onClick={() => setConfirmOpen(true)} className="btn-primary btn-md">
            <Send size={15} /> ثبت نهایی آزمون
          </button>
        )}
      </div>

      {/* confirm modal */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="ثبت نهایی آزمون">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-warn/30 bg-warn/10 p-4 text-sm leading-7 text-warn">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              {answered < qs.length
                ? `${toFa(qs.length - answered)} سؤال بدون پاسخ مانده است. پاسخ‌های داده‌شده ثبت می‌شوند.`
                : "همه سؤال‌ها پاسخ داده شده‌اند."}{" "}
              بعد از ثبت، امکان تغییر پاسخ در این نوبت وجود ندارد.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setConfirmOpen(false)} className="btn-secondary btn-md">
              بازگشت به آزمون
            </button>
            <button
              onClick={() => {
                setConfirmOpen(false);
                finish();
              }}
              disabled={submitting}
              className="btn-primary btn-md"
            >
              {submitting ? "در حال ثبت…" : "تأیید و ثبت نهایی"}
            </button>
          </div>
        </div>
      </Modal>
      {submitError && <p className="mt-4 text-center text-sm text-danger">{submitError}</p>}
    </div>
  );
}
