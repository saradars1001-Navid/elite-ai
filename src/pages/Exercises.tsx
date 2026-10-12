import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Target,
  Wrench,
  ListOrdered,
  Upload,
  Send,
  Lock,
  Eye,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { exerciseTypeLabel } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, toFa, timeAgo } from "../lib/utils";
import { Banner, Progress } from "../components/ui";

export default function Exercises() {
  const { chapterId, exerciseId } = useParams();
  const navigate = useNavigate();
  const { hasAccess, submitExercise, getExerciseStatus, chapterProgress, chapters } = useApp();
  const ch = chapters.find((c) => c.id === chapterId);

  const [answer, setAnswer] = useState<string>("");
  const [order, setOrder] = useState<string[]>([]);
  const [file, setFile] = useState<{ name: string } | null>(null);
  const [, setSubmitted] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string; gained: number } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const ex = ch?.exercises.find((e) => e.id === exerciseId);
  const status = ex ? getExerciseStatus(ex.id) : undefined;
  const progress = ch ? chapterProgress(ch.id) : 0;

  const correctOpt = useMemo(() => {
    if (!ex) return null;
    if (ex.type === "mcq" || ex.type === "prompt-choice") return ex.correctIndex;
    if (ex.type === "truefalse") return ex.correctBool ? 0 : 1;
    return null;
  }, [ex]);

  if (!ch || !ex) {
    return <div className="container-x py-20 text-center text-muted">تمرین پیدا نشد.</div>;
  }

  const canDo = ch.free || hasAccess(ch.id);
  const idx = ch.exercises.findIndex((e) => e.id === ex.id);
  const prev = ch.exercises[idx - 1];
  const next = ch.exercises[idx + 1];

  if (!canDo) {
    return (
      <div className="container-x max-w-2xl py-16">
        <div className="card flex flex-col items-center gap-4 p-10 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface2 text-locked">
            <Lock size={26} />
          </span>
          <h2 className="text-xl font-black">این تمرین محافظت‌شده است</h2>
          <p className="max-w-md text-sm leading-8 text-muted">
            برای انجام تمرین‌های این فصل، ابتدا دسترسی فصل را خریداری کنید.
          </p>
          <button onClick={() => navigate(`/checkout/${ch.id}`)} className="btn-primary btn-md">
            خرید این فصل
          </button>
        </div>
      </div>
    );
  }

  const evaluate = (): { ok: boolean; gained: number; msg: string } => {
    if (ex.type === "mcq" || ex.type === "prompt-choice") {
      const ok = Number(answer) === correctOpt;
      return ok
        ? { ok: true, gained: ex.points, msg: "آفرین! پاسخ درست است." }
        : { ok: false, gained: 0, msg: "پاسخ اشتباه است. پاسخ نمونه را ببینید." };
    }
    if (ex.type === "truefalse") {
      const ok = Number(answer) === correctOpt;
      return ok
        ? { ok: true, gained: ex.points, msg: "آفرین! پاسخ درست است." }
        : { ok: false, gained: 0, msg: "پاسخ اشتباه است. پاسخ نمونه را ببینید." };
    }
    if (ex.type === "ordering") {
      const ok = order.join("|") === (ex.correctOrder || []).join("|");
      return ok
        ? { ok: true, gained: ex.points, msg: "ترتیب درست است! عالی بود." }
        : { ok: false, gained: 0, msg: "ترتیب کامل درست نیست. مقایسه کنید." };
    }
    // short / practical — evaluated by instructor
    return {
      ok: true,
      gained: Math.round(ex.points * 0.8),
      msg: "پاسخ شما ثبت شد و برای ارزیابی مدرس ارسال گردید. امتیاز اولیه بر اساس معیارهای ارزیابی تعلق گرفت.",
    };
  };

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => {
      const res = evaluate();
      setFeedback(res);
      setSubmitted(true);
      submitExercise(ex.id, answer || order.join(" > ") || file?.name || "", res.gained);
      setLoading(false);
    }, 800);
  };

  const isAnswered = ex.type === "ordering" ? order.length === (ex.options?.length || 0) : !!answer;

  return (
    <div className="container-x py-8 sm:py-10">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          <Link to={`/chapters/${ch.id}`} className="text-sky hover:underline">
            فصل {toFa(ch.index)}: {ch.title}
          </Link>
          <span>•</span>
          <span>
            تمرین {toFa(ex.index)} از {toFa(ch.exercises.length)}
          </span>
        </div>
        <h1 className="text-xl font-black sm:text-2xl">{ex.title}</h1>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={progress} className="max-w-xs flex-1" />
          <span className="text-xs text-muted">پیشرفت فصل: {toFa(progress)}٪</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          {/* problem */}
          <div className="card p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="chip border border-sky/25 bg-sky/10 text-sky">
                <Dumbbell size={13} /> {exerciseTypeLabel(ex.type)}
              </span>
              <span className="chip border border-warn/25 bg-warn/10 text-warn">
                {toFa(ex.points)} امتیاز
              </span>
              {status && (
                <span className="chip border border-teal/25 bg-teal/10 text-teal">
                  {status.status}
                </span>
              )}
            </div>
            <h2 className="mb-2 font-bold">مسئله</h2>
            <p className="text-[15px] leading-9 text-text/90">{ex.problem}</p>
          </div>

          {/* goal & guide */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
                <Target size={16} className="text-teal" /> هدف تمرین
              </h3>
              <p className="text-sm leading-7 text-muted">{ex.goal}</p>
              {ex.tool && (
                <p className="mt-3 flex items-center gap-2 rounded-lg border border-line/50 bg-surface2/50 px-3 py-2.5 text-xs text-muted">
                  <Wrench size={14} className="text-sky" /> ابزار پیشنهادی:{" "}
                  <b className="text-text">{ex.tool}</b>
                </p>
              )}
            </div>
            <div className="card p-5">
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
                <Lightbulb size={16} className="text-warn" /> راهنمای انجام
              </h3>
              <ol className="space-y-1.5">
                {ex.guide.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-7 text-muted">
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neon/15 text-[10px] font-bold text-sky">
                      {toFa(i + 1)}
                    </span>
                    {g}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* answer area */}
          <div className="card p-6 sm:p-8">
            <h3 className="mb-4 flex items-center gap-2 font-bold">
              <Sparkles size={17} className="text-neon" /> پاسخ شما
            </h3>

            {(ex.type === "mcq" || ex.type === "prompt-choice") && (
              <div className="space-y-2.5">
                {ex.options?.map((o, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAnswer(String(i));
                      setSubmitted(false);
                    }}
                    disabled={!!status}
                    className={cls(
                      "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-right text-sm transition-colors",
                      Number(answer) === i
                        ? "border-neon bg-neon/10 text-text shadow-[inset_0_0_0_1px_rgba(47,140,255,0.4)]"
                        : "border-line/60 bg-surface2/40 text-muted hover:border-neon/30",
                      status && Number(answer) !== i && "opacity-50"
                    )}
                  >
                    <span
                      className={cls(
                        "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                        Number(answer) === i
                          ? "border-neon bg-neon text-white"
                          : "border-line text-locked"
                      )}
                    >
                      {toFa(i + 1)}
                    </span>
                    <span className="leading-7">{o}</span>
                  </button>
                ))}
              </div>
            )}

            {ex.type === "truefalse" && (
              <div className="grid grid-cols-2 gap-3">
                {(ex.options || []).map((o, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setAnswer(String(i));
                      setSubmitted(false);
                    }}
                    disabled={!!status}
                    className={cls(
                      "rounded-lg border px-4 py-4 text-sm font-bold transition-colors",
                      Number(answer) === i
                        ? i === 0
                          ? "border-teal bg-teal/10 text-teal"
                          : "border-danger bg-danger/10 text-danger"
                        : "border-line/60 bg-surface2/40 text-muted hover:border-neon/30",
                      status && Number(answer) !== i && "opacity-50"
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}

            {ex.type === "ordering" && (
              <div className="space-y-2.5">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <ListOrdered size={14} className="text-sky" />
                  روی گزینه‌ها کلیک کنید تا به ترتیب درست انتخاب شوند.
                </p>
                <div className="space-y-2">
                  {order.map((o, i) => (
                    <button
                      key={o + i}
                      onClick={() => {
                        if (status) return;
                        setOrder((cur) => cur.filter((x) => x !== o));
                      }}
                      className="flex w-full items-center gap-3 rounded-lg border border-neon/40 bg-neon/10 px-4 py-3 text-right text-sm text-text"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neon text-xs font-bold text-white">
                        {toFa(i + 1)}
                      </span>
                      {o}
                    </button>
                  ))}
                </div>
                {order.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-xs text-locked">
                    هنوز گزینه‌ای انتخاب نشده است
                  </p>
                )}
                <div className="flex flex-wrap gap-2 border-t border-line/50 pt-3">
                  {(ex.options || []).map((o) =>
                    order.includes(o) ? null : (
                      <button
                        key={o}
                        onClick={() => {
                          if (status) return;
                          setOrder((cur) => [...cur, o]);
                        }}
                        disabled={!!status}
                        className="rounded-lg border border-line/60 bg-surface2/60 px-3.5 py-2 text-xs text-muted transition-colors hover:border-neon/40 hover:text-text"
                      >
                        {o}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {(ex.type === "short" || ex.type === "practical") && (
              <div className="space-y-4">
                <textarea
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setSubmitted(false);
                  }}
                  disabled={!!status}
                  rows={6}
                  placeholder={
                    ex.type === "practical"
                      ? "روند کار خود را شرح دهید: پرامپت اولیه، اصلاحات و خروجی نهایی…"
                      : "پاسخ خود را اینجا بنویسید…"
                  }
                  className="input resize-none"
                />
                {/* file upload (simulated) */}
                <div>
                  <label
                    className={cls(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-xs transition-colors",
                      file
                        ? "border-teal/50 bg-teal/5 text-teal"
                        : "border-line text-muted hover:border-neon/40 hover:text-sky"
                    )}
                  >
                    <Upload size={16} />
                    {file
                      ? `فایل: ${file.name}`
                      : "برای تمرین عملی می‌توانید تصویر یا فایل ارسال کنید"}
                    <input
                      type="file"
                      className="hidden"
                      disabled={!!status}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setFile({ name: f.name });
                      }}
                    />
                  </label>
                  {file && (
                    <button
                      onClick={() => setFile(null)}
                      className="mt-1.5 text-[11px] text-danger hover:underline"
                    >
                      حذف فایل
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* submit */}
            {!status ? (
              <button
                onClick={handleSubmit}
                disabled={!isAnswered || loading}
                className="btn-primary btn-lg mt-5 w-full sm:w-auto"
              >
                {loading ? (
                  "در حال ثبت…"
                ) : (
                  <>
                    <Send size={17} /> ثبت پاسخ و دریافت امتیاز
                  </>
                )}
              </button>
            ) : (
              <div className="mt-5 space-y-3">
                <Banner
                  kind="success"
                  title="این تمرین انجام شده است"
                  text={`امتیاز کسب‌شده: ${toFa(status.score)} از ${toFa(ex.points)} — ثبت در ${timeAgo(status.submittedAt)}`}
                />
              </div>
            )}
          </div>

          {/* feedback + sample answer */}
          {feedback && (
            <div
              className={cls(
                "card p-6 animate-slide-up",
                feedback.ok ? "border-teal/30" : "border-warn/30"
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <p className={cls("font-bold", feedback.ok ? "text-teal" : "text-warn")}>
                  {feedback.msg}
                </p>
                <span className="chip shrink-0 border border-warn/25 bg-warn/10 text-warn">
                  +{toFa(feedback.gained)} امتیاز
                </span>
              </div>
              <button onClick={() => setShowSample((v) => !v)} className="btn-secondary btn-sm">
                <Eye size={14} /> {showSample ? "بستن" : "مشاهده"} پاسخ نمونه / راهنمای ارزیابی
              </button>
              {showSample && (
                <div className="mt-4 rounded-lg border border-line/60 bg-surface2/50 p-4">
                  <p className="mb-2 text-xs font-bold text-sky">پاسخ نمونه</p>
                  <p className="text-sm leading-8 text-muted">{ex.sampleAnswer}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* sidebar */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-line/60 bg-surface2/50 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Dumbbell size={15} className="text-sky" /> تمرین‌های فصل
              </h3>
            </div>
            <div className="space-y-1 p-2">
              {ch.exercises.map((e) => {
                const s = getExerciseStatus(e.id);
                const active = e.id === ex.id;
                return (
                  <Link
                    key={e.id}
                    to={`/chapters/${ch.id}/exercises/${e.id}`}
                    className={cls(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors",
                      active
                        ? "bg-neon/12 shadow-[inset_0_0_0_1px_rgba(47,140,255,0.35)]"
                        : "hover:bg-surface2"
                    )}
                  >
                    <span
                      className={cls(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                        s
                          ? "bg-teal/15 text-teal"
                          : active
                            ? "bg-navy text-sky"
                            : "bg-surface2 text-muted"
                      )}
                    >
                      {s ? <CheckCircle2 size={14} /> : <Dumbbell size={13} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">
                      {e.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {prev && (
              <Link
                to={`/chapters/${ch.id}/exercises/${prev.id}`}
                className="card flex items-center gap-2 p-3 text-xs text-muted transition-colors hover:border-neon/40 hover:text-text"
              >
                <ChevronRight size={14} /> قبلی
              </Link>
            )}
            {next && (
              <Link
                to={`/chapters/${ch.id}/exercises/${next.id}`}
                className="card flex items-center justify-end gap-2 p-3 text-xs text-muted transition-colors hover:border-neon/40 hover:text-text"
              >
                بعدی <ChevronLeft size={14} />
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
