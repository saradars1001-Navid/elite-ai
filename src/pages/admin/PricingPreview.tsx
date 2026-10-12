import { useState } from "react";
import { Calculator, BadgePercent, Tag, Loader2, Info, Sparkles } from "lucide-react";
import { useApp } from "../../lib/store";
import { AdminHeader } from "./AdminUI";
import { COUPONS, DEFAULT_DISCOUNT_RULES } from "../../lib/data";
import { backendAdminPricingPreview } from "../../lib/backend";
import { isLaravelConfigured } from "../../lib/laravel";
import { price, toFa } from "../../lib/utils";

interface PreviewResult {
  chapter: { id: string; title: string; index: number; free: boolean };
  basePrice: number;
  performanceEligible: boolean;
  performancePercent: number;
  couponPercent: number;
  couponValid: boolean;
  couponMessage: string | null;
  totalPercent: number;
  finalPrice: number;
  discountLabel: string;
  tiers: { label: string; min: number; percent: number }[];
}

const TIER_CHIPS = [90, 80, 70];

export default function AdminPricingPreview() {
  const { chapters } = useApp();
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? "");
  const [examScore, setExamScore] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  const chapter = chapters.find((c) => c.id === chapterId);
  const score = examScore.trim() === "" ? null : Math.max(0, Math.min(100, Number(examScore)));

  /** Local demo calculator — mirrors the server-side rules for previews without a backend. */
  const simulateLocal = (): PreviewResult => {
    const basePrice = Math.max(0, chapter?.price ?? 0);
    const eligible = (chapter?.index ?? 1) > 1;
    const r = DEFAULT_DISCOUNT_RULES;
    let performance = 0;
    if (eligible && score !== null && !Number.isNaN(score)) {
      performance =
        score >= r.high.min
          ? r.high.percent
          : score >= r.mid.min
            ? r.mid.percent
            : score >= r.low.min
              ? r.low.percent
              : 0;
    }
    const code = couponCode.trim();
    const couponPct = code ? (COUPONS[code.toUpperCase()] ?? 0) : 0;
    const totalPercent = Math.min(100, performance + couponPct);
    const labels: string[] = [];
    if (performance > 0) labels.push(`٪${toFa(performance)} عملکردی`);
    if (couponPct > 0) labels.push(`٪${toFa(couponPct)} کد ${code.toUpperCase()}`);

    return {
      chapter: chapter
        ? { id: chapter.id, title: chapter.title, index: chapter.index, free: chapter.free }
        : { id: "", title: "—", index: 1, free: false },
      basePrice,
      performanceEligible: eligible,
      performancePercent: performance,
      couponPercent: couponPct,
      couponValid: couponPct > 0,
      couponMessage: code && couponPct === 0 ? "کد تخفیف نامعتبر است." : null,
      totalPercent,
      finalPrice: Math.max(0, Math.round((basePrice * (100 - totalPercent)) / 100)),
      discountLabel: labels.join(" + "),
      tiers: [
        { label: "عالی", min: r.high.min, percent: r.high.percent },
        { label: "خوب", min: r.mid.min, percent: r.mid.percent },
        { label: "قابل قبول", min: r.low.min, percent: r.low.percent },
      ],
    };
  };

  const simulate = async () => {
    if (!chapterId) {
      setError("فصل را انتخاب کنید.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (isLaravelConfigured()) {
        const res = await backendAdminPricingPreview({
          chapterId,
          examScore: score,
          couponCode: couponCode.trim() || null,
        });
        if (res) {
          setResult(res);
          setLive(true);
          return;
        }
      }
      setResult(simulateLocal());
      setLive(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "محاسبه قیمت ناموفق بود");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <AdminHeader
        title="پیش‌نمایش قیمت‌گذاری"
        desc="با نمره آزمون و کد کوپن فرضی، قیمت نهایی فصل را قبل از اعمال در فروش بررسی کنید"
        action={
          <button onClick={simulate} disabled={loading} className="btn-primary btn-md">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}{" "}
            محاسبه
          </button>
        }
      />

      {error && (
        <div className="mb-5 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* form */}
        <div className="card space-y-5 p-6 lg:col-span-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">فصل</label>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="input w-full"
              aria-label="انتخاب فصل"
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>
                  فصل {toFa(c.index)} — {c.title}
                </option>
              ))}
            </select>
            {chapter?.free && (
              <p className="mt-1.5 text-xs text-muted">
                این فصل رایگان است و قیمتی برای آن محاسبه نمی‌شود.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">نمره آزمون فصل قبل (فرضی)</label>
            <input
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={examScore}
              onChange={(e) => setExamScore(e.target.value)}
              placeholder="مثلاً ۹۵"
              className="input w-full"
              aria-label="نمره آزمون"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TIER_CHIPS.map((t) => (
                <button
                  key={t}
                  onClick={() => setExamScore(String(t))}
                  className={`chip !py-1 transition-colors ${
                    examScore === String(t)
                      ? "border-teal/40 bg-teal/10 text-teal"
                      : "hover:border-line/60"
                  }`}
                >
                  {toFa(t)}
                </button>
              ))}
              <button
                onClick={() => setExamScore("")}
                className="chip !py-1 text-muted transition-colors hover:border-line/60"
              >
                بدون نمره
              </button>
            </div>
            {chapter && (chapter.index ?? 1) <= 1 && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <Info size={13} /> فصل اول مشمول تخفیف عملکردی نیست (تخفیف بر اساس نمره فصل قبل
                است).
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">کد کوپن (فرضی)</label>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="مثلاً ELITE10"
              className="input w-full"
              aria-label="کد کوپن"
            />
          </div>
        </div>

        {/* result */}
        <div className="lg:col-span-3">
          {!result ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-line/60 p-10 text-center">
              <Calculator size={32} className="mb-3 text-muted/50" />
              <p className="text-sm text-muted">
                فصل، نمره و کوپن را تنظیم کنید و «محاسبه» را بزنید تا قیمت نهایی نمایش داده شود.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {!live && (
                <div className="flex items-center gap-2 rounded-lg border border-warn/25 bg-warn/10 px-4 py-2.5 text-xs text-warn">
                  <Sparkles size={14} />
                  سرویس‌دهنده متصل نیست؛ نتیجه با همان قوانین محلی محاسبه شد.
                </div>
              )}

              <div className="card p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">
                      فصل {toFa(result.chapter.index)} — {result.chapter.title}
                    </h3>
                    <p className="text-xs text-muted">قیمت پایه: {price(result.basePrice)}</p>
                  </div>
                  <span className="rounded-lg bg-teal/10 px-4 py-2 text-2xl font-black text-teal">
                    {price(result.finalPrice)}
                  </span>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-navy/60 px-4 py-3">
                    <span className="flex items-center gap-2 text-muted">
                      <BadgePercent size={15} className="text-sky" /> تخفیف عملکردی
                    </span>
                    <span
                      className={
                        result.performancePercent > 0 ? "font-bold text-sky" : "text-muted"
                      }
                    >
                      {result.performancePercent > 0 ? `٪${toFa(result.performancePercent)}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-navy/60 px-4 py-3">
                    <span className="flex items-center gap-2 text-muted">
                      <Tag size={15} className="text-sky" /> تخفیف کوپن
                    </span>
                    <span className={result.couponValid ? "font-bold text-sky" : "text-muted"}>
                      {result.couponPercent > 0 ? `٪${toFa(result.couponPercent)}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-navy/60 px-4 py-3">
                    <span className="text-muted">جمع تخفیف</span>
                    <span className="font-bold">
                      {result.totalPercent > 0 ? `٪${toFa(result.totalPercent)}` : "بدون تخفیف"}
                    </span>
                  </div>
                </div>

                {result.discountLabel && (
                  <p className="mt-4 rounded-lg border border-teal/20 bg-teal/5 px-4 py-2.5 text-xs text-teal">
                    {result.discountLabel}
                  </p>
                )}
                {result.couponMessage && (
                  <p className="mt-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-2.5 text-xs text-danger">
                    {result.couponMessage}
                  </p>
                )}
                {!result.performanceEligible && (chapter?.index ?? 1) > 1 && (
                  <p className="mt-2 text-xs text-muted">
                    برای این فصل، تخفیف عملکردی فقط با نمره آزمون فصل قبل فعال می‌شود.
                  </p>
                )}
              </div>

              {/* tier rules */}
              <div className="card p-6">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <BadgePercent size={16} className="text-teal" /> قوانین تخفیف عملکردی فعلی
                </h4>
                <div className="grid gap-2 sm:grid-cols-3">
                  {result.tiers.map((t) => (
                    <div
                      key={t.label}
                      className="rounded-lg border border-line/40 px-4 py-3 text-center"
                    >
                      <p className="text-xs text-muted">نمره {toFa(t.min)} تا ۱۰۰</p>
                      <p className="mt-1 text-lg font-bold text-teal">٪{toFa(t.percent)}</p>
                      <p className="text-[11px] text-muted">{t.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
