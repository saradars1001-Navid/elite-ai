import { useState } from "react";
import {
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  CreditCard,
  Tag,
  Database,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { AdminHeader, Toggle, Badge } from "./AdminUI";
import { useApp } from "../../lib/store";
import { Modal } from "../../components/ui";
import { QUESTION_CATEGORIES, QUESTION_DIFFICULTIES } from "../../lib/data";
import { toFa, uid } from "../../lib/utils";
import type { QuestionBankEntry } from "../../lib/types";

export default function AdminSettings() {
  const { site, updateSite, coupons, setCoupons, questionBank, saveQuestion, deleteQuestion } =
    useApp();
  const [brand, setBrand] = useState({ name: site.name, slogan: site.slogan });
  const [contact, setContact] = useState({ phone: site.supportPhone, email: site.supportEmail });
  const [toggles, setToggles] = useState(site.toggles);
  const [saved, setSaved] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponPct, setCouponPct] = useState(15);
  const [qEditor, setQEditor] = useState<QuestionBankEntry | null>(null);
  const [qNew, setQNew] = useState(false);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const save = () => {
    updateSite({
      name: brand.name,
      slogan: brand.slogan,
      supportPhone: contact.phone,
      supportEmail: contact.email,
      toggles,
    });
    flash();
  };

  const addCoupon = () => {
    const key = couponCode.trim().toUpperCase();
    if (!key) return;
    setCoupons({ ...coupons, [key]: couponPct });
    setCouponCode("");
    flash();
  };

  const saveQ = (q: QuestionBankEntry) => {
    saveQuestion(q);
    setQEditor(null);
    flash();
  };

  return (
    <div>
      <AdminHeader
        title="تنظیمات سایت"
        desc="هویت برند، اطلاعات تماس، درگاه پرداخت، کدهای تخفیف و بانک سؤال"
        action={
          <button onClick={save} className="btn-primary btn-md">
            <Save size={15} /> ذخیره {saved && "✓"}
          </button>
        }
      />

      <div className="space-y-6">
        {/* brand */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <SettingsIcon size={17} className="text-sky" /> هویت برند
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">نام پلتفرم</label>
              <input
                value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">شعار اصلی</label>
              <input
                value={brand.slogan}
                onChange={(e) => setBrand({ ...brand, slogan: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </section>

        {/* contact */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <ShieldCheck size={17} className="text-teal" /> اطلاعات تماس و پشتیبانی
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">تلفن پشتیبانی</label>
              <input
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                className="input"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label">ایمیل</label>
              <input
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                className="input"
                dir="ltr"
              />
            </div>
          </div>
        </section>

        {/* toggles */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <CreditCard size={17} className="text-warn" /> ویژگی‌ها و قوانین نمایش
          </h2>
          <div className="divide-y divide-line/40">
            {(
              [
                { k: "gateway", l: "فعال بودن درگاه پرداخت", d: "امکان خرید فصل با درگاه آنلاین" },
                { k: "wallet", l: "کیف پول", d: "پرداخت از موجودی کیف پول کاربران" },
                { k: "sms", l: "ارسال پیامک", d: "ارسال کد تأیید و اعلان از طریق پیامک" },
                { k: "comments", l: "کامنت‌گذاری", d: "اجازه ثبت نظر برای کاربران" },
                { k: "guestQuiz", l: "کوییز مهمان", d: "اجازه شرکت در کوییز برای کاربران مهمان" },
              ] as { k: keyof typeof toggles; l: string; d: string }[]
            ).map((t) => (
              <div key={t.k} className="flex items-center justify-between gap-4 py-3.5">
                <div>
                  <p className="text-sm font-bold">{t.l}</p>
                  <p className="text-xs text-muted">{t.d}</p>
                </div>
                <Toggle
                  on={toggles[t.k]}
                  onChange={(v) => setToggles((s) => ({ ...s, [t.k]: v }))}
                  label={t.l}
                />
              </div>
            ))}
          </div>
        </section>

        {/* coupons */}
        <section className="card p-6">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <Tag size={17} className="text-sky" /> کدهای تخفیف
          </h2>
          <p className="mb-4 text-xs text-muted">
            کدها در سبد خرید قابل استفاده هستند؛ استفاده از هر کد فقط یک بار برای هر حساب.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="input"
              dir="ltr"
              placeholder="مثلاً ELITE30"
            />
            <input
              type="number"
              value={couponPct}
              onChange={(e) => setCouponPct(Number(e.target.value))}
              className="input"
              dir="ltr"
              placeholder="٪"
            />
            <button onClick={addCoupon} className="btn-primary btn-md">
              <Plus size={15} /> افزودن کد
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(coupons).map(([code, pct]) => (
              <div
                key={code}
                className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <Badge tone="info">{code}</Badge>
                  <span className="text-sm font-bold text-teal">٪{toFa(pct)}</span>
                </div>
                <button
                  onClick={() => {
                    const next = { ...coupons };
                    delete next[code];
                    setCoupons(next);
                    flash();
                  }}
                  className="btn-ghost btn-sm !px-2 text-danger"
                  aria-label={`حذف کد ${code}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* question bank */}
        <section className="card p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Database size={17} className="text-teal" /> بانک سؤال کوییز (
              {toFa(questionBank.length)})
            </h2>
            <button
              onClick={() => {
                setQNew(true);
                setQEditor({
                  id: uid("qb"),
                  text: "",
                  options: ["", "", "", ""],
                  correct: 0,
                  explanation: "",
                  category: QUESTION_CATEGORIES[0],
                  difficulty: "آسان",
                });
              }}
              className="btn-primary btn-sm"
            >
              <Plus size={13} /> سؤال جدید
            </button>
          </div>
          <p className="mb-4 text-xs text-muted">
            تولید خودکار کوییزها از این بانک انجام می‌شود؛ کوییزهای روزانه/هفتگی را می‌توانید از بخش
            «کوییزها» بازتولید کنید.
          </p>
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {questionBank.map((q) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{q.category}</Badge>
                    <Badge
                      tone={
                        q.difficulty === "سخت"
                          ? "danger"
                          : q.difficulty === "متوسط"
                            ? "warn"
                            : "success"
                      }
                    >
                      {q.difficulty}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{q.text}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => {
                      setQNew(false);
                      setQEditor(q);
                    }}
                    className="btn-ghost btn-sm !px-2 text-sky"
                    aria-label="ویرایش سؤال"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      deleteQuestion(q.id);
                      flash();
                    }}
                    className="btn-ghost btn-sm !px-2 text-danger"
                    aria-label="حذف سؤال"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* question editor */}
      <Modal
        open={!!qEditor}
        onClose={() => setQEditor(null)}
        title={qNew ? "افزودن سؤال" : "ویرایش سؤال"}
        wide
      >
        {qEditor && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">دسته‌بندی</label>
                <select
                  value={qEditor.category}
                  onChange={(e) => setQEditor({ ...qEditor, category: e.target.value })}
                  className="input"
                >
                  {QUESTION_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">سطح</label>
                <select
                  value={qEditor.difficulty}
                  onChange={(e) =>
                    setQEditor({
                      ...qEditor,
                      difficulty: e.target.value as QuestionBankEntry["difficulty"],
                    })
                  }
                  className="input"
                >
                  {QUESTION_DIFFICULTIES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">متن سؤال</label>
              <textarea
                value={qEditor.text}
                onChange={(e) => setQEditor({ ...qEditor, text: e.target.value })}
                rows={2}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="label">گزینه‌ها (هر گزینه در یک خط)</label>
              <textarea
                value={qEditor.options.join("\n")}
                onChange={(e) =>
                  setQEditor({
                    ...qEditor,
                    options: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                rows={4}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="label">گزینه صحیح (شماره از ۰)</label>
              <input
                type="number"
                value={qEditor.correct}
                onChange={(e) => setQEditor({ ...qEditor, correct: Number(e.target.value) })}
                className="input"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label">توضیح پاسخ</label>
              <textarea
                value={qEditor.explanation}
                onChange={(e) => setQEditor({ ...qEditor, explanation: e.target.value })}
                rows={2}
                className="input resize-none"
              />
            </div>
            <button
              onClick={() => saveQ(qEditor)}
              disabled={!qEditor.text.trim()}
              className="btn-primary btn-md w-full"
            >
              <Save size={15} /> {qNew ? "افزودن سؤال" : "ذخیره سؤال"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
