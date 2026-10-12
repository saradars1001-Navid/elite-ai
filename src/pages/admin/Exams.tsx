import { ChGlyph } from "../../lib/entityIcons";
import { useState } from "react";
import { ClipboardCheck, Save, BadgePercent, RotateCcw } from "lucide-react";
import { DEFAULT_DISCOUNT_RULES, type DiscountRules } from "../../lib/data";
import { useApp } from "../../lib/store";
import { AdminHeader, Table, Td, TRow } from "./AdminUI";
import { toFa } from "../../lib/utils";

export default function AdminExams() {
  const { state, chapters, setDiscountRules, saveChapter } = useApp();
  const [rules, setRules] = useState<DiscountRules>(state.discountRules);
  const [saved, setSaved] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(chapters.map((c) => [c.id, c.exam.passScore]))
  );

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const saveAll = () => {
    setDiscountRules(rules);
    chapters.forEach((c) => {
      const v = scores[c.id];
      if (v !== undefined && v !== c.exam.passScore) {
        saveChapter({ ...c, exam: { ...c.exam, passScore: v } });
      }
    });
    flash();
  };

  const setTier = (tier: keyof DiscountRules, field: "min" | "percent", v: number) =>
    setRules((r) => ({ ...r, [tier]: { ...r[tier], [field]: v } }));

  return (
    <div>
      <AdminHeader
        title="آزمون‌ها و تخفیف‌ها"
        desc="نمره قبولی آزمون‌ها و درصد تخفیف عملکردی — از اینجا قابل تغییر"
        action={
          <button onClick={saveAll} className="btn-primary btn-md">
            <Save size={15} /> {saved ? "ذخیره شد ✓" : "ذخیره"}
          </button>
        }
      />

      {/* discount rules */}
      <div className="card mb-6 p-6">
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <BadgePercent size={18} className="text-teal" /> قوانین تخفیف عملکردی
        </h2>
        <p className="mb-5 text-xs text-muted">
          این درصدها هنگام نمره‌دهی آزمون‌ها اعمال می‌شوند و در سبد خرید فصل بعد به‌صورت خودکار
          محاسبه می‌گردند.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              { tier: "high", label: "عالی", desc: "نمره ۹۰ تا ۱۰۰", tone: "border-teal/30" },
              { tier: "mid", label: "خوب", desc: "نمره ۸۰ تا ۸۹", tone: "border-sky/30" },
              { tier: "low", label: "قابل قبول", desc: "نمره ۷۰ تا ۷۹", tone: "border-warn/30" },
            ] as { tier: keyof DiscountRules; label: string; desc: string; tone: string }[]
          ).map((t) => (
            <div key={t.tier} className={`rounded-lg border bg-surface2/40 p-4 ${t.tone}`}>
              <p className="font-bold">{t.label}</p>
              <p className="mb-3 text-[11px] text-muted">{t.desc}</p>
              <div className="space-y-2.5">
                <div>
                  <label className="mb-1 block text-[11px] text-muted">حداقل نمره</label>
                  <input
                    type="number"
                    value={rules[t.tier].min}
                    onChange={(e) => setTier(t.tier, "min", Number(e.target.value))}
                    className="input !py-2 text-sm"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted">درصد تخفیف</label>
                  <input
                    type="number"
                    value={rules[t.tier].percent}
                    onChange={(e) => setTier(t.tier, "percent", Number(e.target.value))}
                    className="input !py-2 text-sm"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setRules(DEFAULT_DISCOUNT_RULES)} className="btn-ghost btn-sm mt-4">
          <RotateCcw size={13} /> بازنشانی به پیش‌فرض
        </button>
      </div>

      {/* exams table */}
      <Table head={["فصل", "عنوان آزمون", "سؤالات", "حداقل قبولی", "سؤال‌ها قابل ویرایش"]}>
        {chapters.map((c) => (
          <TRow key={c.id}>
            <Td>
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy">
                  <ChGlyph id={c.id} size={17} />
                </span>
                <div>
                  <p className="font-bold">{c.title}</p>
                  <p className="text-[11px] text-muted">فصل {toFa(c.index)}</p>
                </div>
              </div>
            </Td>
            <Td className="text-muted">{c.exam.title}</Td>
            <Td>{toFa(c.exam.questions.length)}</Td>
            <Td>
              <input
                type="number"
                value={scores[c.id]}
                onChange={(e) => setScores((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                className="input !w-20 !py-1.5 text-xs"
                dir="ltr"
              />
            </Td>
            <Td>
              <span className="text-xs text-muted">از صفحه «فصل‌ها و درس‌ها» → تب آزمون</span>
            </Td>
          </TRow>
        ))}
      </Table>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <ClipboardCheck size={14} className="text-sky" />
        برای افزودن یا حذف سؤال‌های آزمون، از بخش «فصل‌ها و درس‌ها» و تب «آزمون» استفاده کنید.
        زمان‌سنج، ذخیره موقت پاسخ‌ها و جلوگیری از ارسال چندباره فعال است.
      </p>
    </div>
  );
}
