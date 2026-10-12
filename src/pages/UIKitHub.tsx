import React, { useState } from "react";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Gamepad2,
  Home,
  LayoutDashboard,
  PlaySquare,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  UserCircle2,
  Users,
  Wand2,
  Wrench,
} from "lucide-react";
import { Logo, Modal, Progress } from "../components/ui";
import useConfirm from "../components/ui-kit/UseConfirm";
import { cls, toFa } from "../lib/utils";

/* ─────────────────────────── رنگ‌های پروژه ─────────────────────────── */

const PALETTE = [
  { token: "base", hex: "#070B14", name: "پس‌زمینه اصلی" },
  { token: "surface", hex: "#0D1422", name: "سطح کارت" },
  { token: "surface2", hex: "#121C2E", name: "سطح دوم" },
  { token: "navy", hex: "#101A2B", name: "سرمه‌ای" },
  { token: "line", hex: "#223149", name: "خط و مرز" },
  { token: "neon", hex: "#3B82F6", name: "رنگ اصلی (نئون)" },
  { token: "sky", hex: "#57B8FF", name: "آبی روشن" },
  { token: "teal", hex: "#20D6B5", name: "سبزآبی" },
  { token: "text", hex: "#F5F7FA", name: "متن اصلی" },
  { token: "muted", hex: "#9AA8BA", name: "متن کم‌رنگ" },
  { token: "danger", hex: "#EF4444", name: "خطا" },
  { token: "warn", hex: "#F59E0B", name: "هشدار" },
];

const TYPE_SAMPLE = "الف ب پ ت ث ج چ ح خ ۰۱۲۳۴۵۶۷۸۹";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-text">{title}</h3>
        <a href={`#${id}`} className="text-xs text-neon hover:underline">
          #
        </a>
      </div>
      <div className="card p-6">{children}</div>
    </section>
  );
}

function Col({ head, children }: { head: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">{head}</span>
      {children}
    </div>
  );
}

const ICONS = [
  { icon: Home, label: "خانه" },
  { icon: BookOpen, label: "یادگیری" },
  { icon: Gamepad2, label: "کوییز" },
  { icon: Users, label: "کامیونیتی" },
  { icon: Wand2, label: "پرامپت‌لب" },
  { icon: Wrench, label: "ابزارها" },
  { icon: PlaySquare, label: "ویدئو" },
  { icon: TrendingUp, label: "ترندها" },
  { icon: Bell, label: "اعلان" },
  { icon: LayoutDashboard, label: "داشبورد" },
  { icon: Search, label: "جستجو" },
  { icon: Settings, label: "تنظیمات" },
];

const NAV = [
  { icon: Home, label: "خانه" },
  { icon: BookOpen, label: "یادگیری" },
  { icon: Gamepad2, label: "کوییز" },
  { icon: Users, label: "کامیونیتی" },
  { icon: UserCircle2, label: "پروفایل" },
];

export default function UIKitHub() {
  const ui = useConfirm();
  const [seg, setSeg] = useState("all");
  const [slider, setSlider] = useState(10);
  const [mood, setMood] = useState(3);
  const [step, setStep] = useState(1);
  const [checks, setChecks] = useState<Record<string, boolean>>({ a: true, b: false });
  const [radio, setRadio] = useState("online");
  const [switchOn, setSwitchOn] = useState(true);
  const [progress, setProgress] = useState(64);

  const moods = ["😞", "🙁", "😐", "🙂", "😀"];

  return (
    <div className="container-x page-body">
      {/* سربرگ */}
      <header className="page-head">
        <div className="flex items-center gap-4">
          <Logo size="lg" />
        </div>
        <div>
          <span className="section-label">
            <Sparkles size={13} /> راهنمای طراحی
          </span>
          <h1 className="page-title mt-2">کیت رابط کاربری آکادمی ایلیت</h1>
          <p className="page-sub">
            مجموعه‌ی زنده‌ی اجزای رابط کاربری، با پالت تیره‌ی خود پروژه — بدون تغییر در رنگ‌های
            اصلی.
          </p>
        </div>
      </header>

      {/* ۱. پالت رنگ */}
      <Section id="palette" title="۱. پالت رنگ پروژه">
        <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {PALETTE.map((c) => (
            <div key={c.token} className="flex items-center gap-3">
              <span
                className="h-12 w-12 shrink-0 rounded-full border border-line/60 shadow-card"
                style={{ background: c.hex }}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-text">{c.name}</span>
                <span className="block font-mono text-[11px] text-muted" dir="ltr">
                  {c.hex}
                </span>
                <span className="block font-mono text-[11px] text-locked" dir="ltr">
                  {c.token}
                </span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ۲. تایپوگرافی */}
      <Section id="typography" title="۲. تایپوگرافی">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text">وزیرمتن · Bold</span>
              <span className="text-[10px] text-muted">تیتر</span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-text">{TYPE_SAMPLE}</p>
            <p className="mt-2 text-sm text-muted">
              تیترها با وزن Bold و فاصله‌ی حروف فشرده، برای خوانایی در متن فارسی.
            </p>
          </div>
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-text">وزیرمتن · Regular</span>
              <span className="text-[10px] text-muted">متن اصلی</span>
            </div>
            <p className="text-base text-text">{TYPE_SAMPLE}</p>
            <p className="mt-2 text-sm text-muted">
              متن بدنه با وزن Regular و ارتفاع خط باز، برای مطالعه‌ی طولانی روی صفحه.
            </p>
          </div>
        </div>
      </Section>

      {/* ۳. دکمه‌ها */}
      <Section id="buttons" title="۳. دکمه‌ها">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Col head="اصلی">
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary btn-md">شروع کنید</button>
              <button className="btn-primary btn-sm">کوچک</button>
              <button className="btn-primary btn-sm" disabled>
                غیرفعال
              </button>
            </div>
          </Col>
          <Col head="ثانویه و ملایم">
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary btn-md">ادامه</button>
              <button className="btn-ghost btn-md">بعداً</button>
              <button className="btn-icon" aria-label="جستجو">
                <Search size={18} />
              </button>
            </div>
          </Col>
          <Col head="وضعیتی">
            <div className="flex flex-wrap gap-2">
              <button className="btn-success btn-sm">تأیید</button>
              <button className="btn-warn btn-sm">هشدار</button>
              <button className="btn-danger btn-sm">حذف</button>
            </div>
          </Col>
        </div>
      </Section>

      {/* ۴. فیلدهای ورودی */}
      <Section id="inputs" title="۴. فیلدهای ورودی">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="kit-name">
              نام کامل
            </label>
            <input id="kit-name" className="input" placeholder="مثلاً نوید رضایی" />
          </div>
          <div>
            <label className="label" htmlFor="kit-error">
              شماره موبایل (نمونه خطا)
            </label>
            <input id="kit-error" className="input input-error" defaultValue="091234" />
            <p className="input-counter text-danger">شماره وارد‌شده کامل نیست</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="kit-note">
              یادداشت
            </label>
            <textarea id="kit-note" className="input-textarea" placeholder="توضیح کوتاه..." />
          </div>
        </div>
      </Section>

      {/* ۵. کنترل‌ها */}
      <Section id="controls" title="۵. کلید، چک‌باکس و رادیو">
        <div className="grid gap-6 sm:grid-cols-3">
          <Col head="کلید">
            <label className="switch">
              <input
                type="checkbox"
                checked={switchOn}
                onChange={(e) => setSwitchOn(e.target.checked)}
              />
              <span className="track">
                <span className="thumb" />
              </span>
            </label>
          </Col>
          <Col head="چک‌باکس">
            {["a", "b"].map((k) => (
              <label key={k} className="checkbox">
                <input
                  type="checkbox"
                  checked={checks[k]}
                  onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))}
                />
                گزینه {k === "a" ? "اول" : "دوم"}
              </label>
            ))}
          </Col>
          <Col head="رادیو">
            {["online", "onsite"].map((v) => (
              <label key={v} className="radio">
                <input
                  type="radio"
                  name="kit-mode"
                  checked={radio === v}
                  onChange={() => setRadio(v)}
                />
                {v === "online" ? "آنلاین" : "حضوری"}
              </label>
            ))}
          </Col>
        </div>
      </Section>

      {/* ۶. اسلایدر */}
      <Section id="slider" title="۶. نوار لغزنده">
        <div className="max-w-md">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">مدت زمان</span>
            <span className="font-bold text-sky">{toFa(slider)} دقیقه</span>
          </div>
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
            className="slider"
          />
        </div>
      </Section>

      {/* ۷. کارت‌ها و پیشرفت */}
      <Section id="cards" title="۷. کارت و نوار پیشرفت">
        <div className="grid gap-5 sm:grid-cols-2">
          <article className="card overflow-hidden">
            <div className="card-image grid h-36 place-items-center bg-gradient-to-bl from-neon/20 via-surface2 to-surface2">
              <Sparkles size={34} className="text-sky" />
            </div>
            <div className="p-5">
              <h4 className="card-title">مبانی پرامپت‌نویسی</h4>
              <p className="card-text">از ساختار درخواست تا کنترل خروجی مدل.</p>
              <div className="card-bottom">
                <span className="text-xs text-muted">۱۲ درس</span>
                <button className="btn-primary btn-sm">شروع</button>
              </div>
            </div>
          </article>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-bold text-text">پیشرفت دوره</span>
              <span className="text-teal">{toFa(progress)}٪</span>
            </div>
            <Progress value={progress} />
            <div className="mt-4 flex gap-2">
              <button
                className="btn-ghost btn-sm"
                onClick={() => setProgress((p) => Math.max(0, p - 10))}
              >
                ۱۰٪ کم‌تر
              </button>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setProgress((p) => Math.min(100, p + 10))}
              >
                ۱۰٪ بیش‌تر
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ۸. چیپ، بج و حالت‌ها */}
      <Section id="chips" title="۸. چیپ، بج و امتیازدهی">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <span className="chip border-neon/40 bg-neon/10 text-sky">هوش مصنوعی</span>
            <span className="chip border-teal/40 bg-teal/10 text-teal">تکمیل‌شده</span>
            <span className="chip border-line/60 bg-surface2 text-muted">جستجو</span>
            <span className="badge-primary">جدید</span>
            <span className="badge-teal">رایگان</span>
            <span className="badge-warn">محدود</span>
            <span className="badge-num">۳</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="segmented">
              {[
                { id: "all", label: "همه" },
                { id: "mine", label: "دوره‌های من" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={cls(seg === s.id && "active")}
                  onClick={() => setSeg(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {moods.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(i)}
                  aria-label={`امتیاز ${toFa(i)}`}
                  className={cls(
                    "grid h-11 w-11 place-items-center rounded-full border text-xl transition-all",
                    mood === i
                      ? "border-neon/60 bg-neon/15 shadow-glow-sm"
                      : "border-line/50 bg-surface2 hover:border-line"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ۹. گام‌شمار */}
      <Section id="stepper" title="۹. گام‌شمار">
        <div className="stepper max-w-md">
          {["انتخاب دوره", "پرداخت", "شروع یادگیری"].map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className={cls("step-line", i <= step && "bg-neon/60")} />}
              <button
                type="button"
                onClick={() => setStep(i)}
                className={cls("step", i === step && "active", i < step && "done")}
              >
                <span className="step-circle">
                  {i < step ? <CheckCircle2 size={16} /> : toFa(i + 1)}
                </span>
                <span className="whitespace-nowrap">{s}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </Section>

      {/* ۱۰. ناوبری */}
      <Section id="nav" title="۱۰. ناوبری">
        <div className="grid gap-6 lg:grid-cols-2">
          <Col head="منوی کناری">
            <nav className="w-full max-w-xs space-y-1 rounded-xl border border-line/60 bg-surface2/60 p-2">
              {NAV.map((n, i) => (
                <span
                  key={n.label}
                  className={cls(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    i === 0
                      ? "bg-neon/12 text-sky shadow-[inset_0_0_0_1px_rgba(47,140,255,0.35)]"
                      : "text-muted"
                  )}
                >
                  <n.icon size={18} /> {n.label}
                </span>
              ))}
            </nav>
          </Col>
          <Col head="ناوبری پایین (موبایل)">
            <div className="grid grid-cols-5 overflow-hidden rounded-2xl border border-line/60 bg-surface/95 backdrop-blur-xl">
              {NAV.map((n, i) => (
                <span
                  key={n.label}
                  className={cls(
                    "flex flex-col items-center gap-1 py-3 text-[10px] font-medium",
                    i === 0 ? "text-neon" : "text-locked"
                  )}
                >
                  <n.icon size={20} />
                  {n.label}
                </span>
              ))}
            </div>
          </Col>
        </div>
      </Section>

      {/* ۱۱. آیکون‌ها */}
      <Section id="icons" title="۱۱. آیکون‌ها">
        <div className="icon-grid">
          {ICONS.map((it) => (
            <div key={it.label} className="icon-cell">
              <it.icon />
              <span>{it.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ۱۲. پنجره تأیید */}
      <Section id="modal" title="۱۲. پنجره تأیید">
        <button
          className="btn-primary btn-md"
          onClick={() =>
            ui.confirm({
              title: "حذف آیتم",
              body: (
                <p className="text-sm text-muted">
                  آیا از حذف این مورد مطمئن هستید؟ این کار قابل بازگشت نیست.
                </p>
              ),
              confirmLabel: "حذف کن",
            })
          }
        >
          نمایش پنجره تأیید
        </button>

        <Modal open={ui.open} onClose={ui.onCancel} title={ui.title}>
          {ui.body}
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost btn-sm" onClick={ui.onCancel}>
              {ui.cancelLabel}
            </button>
            <button className="btn-danger btn-sm" onClick={ui.onConfirm}>
              {ui.confirmLabel}
            </button>
          </div>
        </Modal>
      </Section>

      {/* ۱۳. پیام‌ها */}
      <Section id="alerts" title="۱۳. پیام‌ها و حالت خالی">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-teal">
            تغییرات با موفقیت ذخیره شد.
          </div>
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            اتصال به سرور برقرار نشد.
          </div>
          <div className="rounded-xl border border-neon/30 bg-neon/10 px-4 py-3 text-sm text-sky">
            فصل جدید در دسترس است.
          </div>
          <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
            مهلت تخفیف رو به پایان است.
          </div>
        </div>

        <div className="mt-5">
          <Col head="حالت خالی">
            <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-neon/10 text-sky">
                <ChevronDown size={22} />
              </span>
              <h4 className="font-bold text-text">هنوز چیزی اینجا نیست</h4>
              <p className="max-w-xs text-sm text-muted">
                با شروع اولین درس، محتوای این بخش نمایش داده می‌شود.
              </p>
              <button className="btn-primary btn-sm mt-1">شروع یادگیری</button>
            </div>
          </Col>
        </div>
      </Section>

      <footer className="mt-12 border-t border-line/50 pt-6 text-center text-xs text-muted">
        <p>کیت رابط کاربری آکادمی ایلیت · رنگ‌ها همان پالت اصلی پروژه هستند.</p>
      </footer>
    </div>
  );
}
