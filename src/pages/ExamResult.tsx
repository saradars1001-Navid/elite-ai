import { Link, useParams } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  BadgePercent,
  Share2,
  ArrowLeft,
  Trophy,
  ClipboardCheck,
  CalendarClock,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, toFa, formatDate } from "../lib/utils";
import { Progress, Banner } from "../components/ui";

export default function ExamResult() {
  const { chapterId, attemptId } = useParams();
  const { state, chapters } = useApp();
  const ch = chapters.find((c) => c.id === chapterId);
  const attempt = state.examAttempts.find((a) => a.id === attemptId);

  if (!ch || !attempt) {
    return (
      <div className="container-x py-20 text-center text-muted">
        نتیجه آزمون یافت نشد.{" "}
        <Link to={`/chapters/${chapterId}`} className="text-sky underline">
          بازگشت به فصل
        </Link>
      </div>
    );
  }

  const circleR = 52;
  const circleC = 2 * Math.PI * circleR;

  return (
    <div className="container-x max-w-3xl py-10 sm:py-14">
      {/* score card */}
      <div className="card relative overflow-hidden p-8 text-center sm:p-10">
        <div className="bg-grid absolute inset-0 opacity-50" />
        <div className="absolute -top-20 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-neon/10 blur-[80px]" />
        <div className="relative">
          <p className="mb-1 text-sm text-muted">نتیجه آزمون</p>
          <h1 className="mb-1 text-xl font-black sm:text-2xl">{ch.exam.title}</h1>
          <p className="mb-8 text-xs text-muted">{formatDate(attempt.date)}</p>

          {/* gauge */}
          <div className="relative mx-auto h-36 w-36" dir="ltr">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={circleR - 8}
                fill="none"
                stroke="#223149"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r={circleR - 8}
                fill="none"
                stroke={attempt.score >= ch.exam.passScore ? "#20D6B5" : "#EF4444"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circleC}
                strokeDashoffset={circleC * (1 - attempt.score / 100)}
                style={{ transition: "stroke-dashoffset 1.2s ease" }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <p className="text-4xl font-black text-text">{toFa(attempt.score)}</p>
                <p className="text-xs text-muted">از ۱۰۰</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <span
              className={cls(
                "chip !px-4 !py-2 text-sm",
                attempt.passed
                  ? "border border-teal/30 bg-teal/10 text-teal"
                  : "border border-danger/30 bg-danger/10 text-danger"
              )}
            >
              {attempt.passed ? (
                <>
                  <CheckCircle2 size={15} /> قبول شدید — آفرین!
                </>
              ) : (
                <>
                  <XCircle size={15} /> قبول نشدید — دوباره تلاش کنید
                </>
              )}
            </span>
          </div>

          {/* correct/wrong */}
          <div className="mx-auto mt-7 grid max-w-sm grid-cols-2 gap-3">
            <div className="rounded-lg border border-teal/25 bg-teal/5 px-4 py-3">
              <p className="text-2xl font-black text-teal">{toFa(attempt.correct)}</p>
              <p className="text-xs text-muted">پاسخ صحیح</p>
            </div>
            <div className="rounded-lg border border-danger/25 bg-danger/5 px-4 py-3">
              <p className="text-2xl font-black text-danger">{toFa(attempt.wrong)}</p>
              <p className="text-xs text-muted">پاسخ غلط</p>
            </div>
          </div>
        </div>
      </div>

      {/* discount award */}
      {attempt.passed && (
        <div
          className={cls(
            "card mt-6 overflow-hidden border",
            attempt.awardedDiscount ? "border-teal/30" : "border-line"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-3.5">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal/15 text-teal">
                <BadgePercent size={22} />
              </span>
              <div>
                <h3 className="font-bold">
                  {attempt.awardedDiscount
                    ? `تخفیف ${toFa(attempt.awardedDiscount)}٪ برای فصل بعد فعال شد!`
                    : "برای دریافت تخفیف، نمره ۷۰ به بالا لازم است"}
                </h3>
                <p className="mt-0.5 text-xs leading-6 text-muted">
                  {attempt.awardedDiscount
                    ? `این تخفیف تا ۱۴ روز آینده در سبد خرید فصل ${toFa(ch.index + 1)} به‌صورت خودکار اعمال می‌شود و قابل انتقال نیست.`
                    : `با نمره ۹۰+ تخفیف ۳۰٪، نمره ۸۰+ تخفیف ۲۰٪ و نمره ۷۰+ تخفیف ۱۰٪ برای فصل بعد دریافت می‌کنید.`}
                </p>
              </div>
            </div>
            {attempt.awardedDiscount && ch.index < 6 && (
              <Link
                to={`/checkout/${chapters[ch.index].id}`}
                className="btn-success btn-md shrink-0"
              >
                استفاده از تخفیف
              </Link>
            )}
          </div>
        </div>
      )}

      {/* thematic analysis */}
      <div className="card mt-6 p-6">
        <h3 className="mb-4 flex items-center gap-2 font-bold">
          <ClipboardCheck size={18} className="text-sky" /> تحلیل موضوعی عملکرد
        </h3>
        <div className="space-y-4">
          {attempt.topicAnalysis.map((t) => {
            const pct = Math.round((t.correct / t.total) * 100);
            return (
              <div key={t.topic}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{t.topic}</span>
                  <span className="text-xs text-muted">
                    {toFa(t.correct)} از {toFa(t.total)} صحیح
                  </span>
                </div>
                <Progress
                  value={pct}
                  color={pct >= 80 ? "bg-teal" : pct >= 50 ? "bg-warn" : "bg-danger"}
                  className="h-2"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <Link to={`/chapters/${ch.id}`} className="btn-secondary btn-md">
            <ArrowLeft size={15} /> بازگشت به فصل
          </Link>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(
                `نمره من در آزمون «${ch.exam.title}» آکادمی ایلیت: ${toFa(attempt.score)} از ۱۰۰`
              );
            }}
            className="btn-ghost btn-md"
          >
            <Share2 size={15} /> اشتراک نتیجه
          </button>
        </div>
        {!attempt.passed && (
          <div className="flex items-center gap-2 rounded-lg border border-warn/25 bg-warn/5 px-4 py-2.5 text-xs text-warn">
            <CalendarClock size={15} />
            <span>شرکت مجدد: از {formatDate(new Date(Date.now() + 86400000).toISOString())}</span>
          </div>
        )}
        {attempt.passed && (
          <Link to={`/chapters/${ch.id}`} className="btn-primary btn-md">
            <Trophy size={16} /> ادامه مسیر
          </Link>
        )}
      </div>

      {attempt.passed && (
        <div className="mt-4">
          <Banner
            kind="info"
            title="قوانین تکرار آزمون"
            text="شرکت مجدد در آزمون پس از قبولی، تا ۷ روز بعد مجاز نیست. در صورت تکرار، بهترین نمره شما برای محاسبه تخفیف ملاک است."
          />
        </div>
      )}
    </div>
  );
}
