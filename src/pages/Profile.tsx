import { BadgeGlyph, PackGlyph } from "../lib/entityIcons";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  UserCircle2,
  Smartphone,
  LogOut,
  BadgePercent,
  Award,
  BookOpen,
  ClipboardCheck,
  Gamepad2,
  StickyNote,
  Receipt as ReceiptIcon,
  Headphones,
  FileText,
  ChevronLeft,
  CheckCircle2,
  Flame,
  Trophy,
  Lock,
  Clock,
  ShieldCheck,
  Wallet,
  Plus,
  ArrowDownLeft,
  ArrowUpLeft,
  Loader2,
  XCircle,
  RotateCcw,
  MessageSquareWarning,
} from "lucide-react";
import { BADGES, levelStyles } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, toFa, formatDate, timeAgo, price } from "../lib/utils";
import { Avatar, Progress, Tabs, EmptyState, LevelCard } from "../components/ui";

export default function Profile() {
  const {
    user,
    state,
    logout,
    chapterProgress,
    earnedBadges,
    activeDiscount,
    xp,
    level,
    matchStats,
    chapters,
    communityPosts,
    communityComments,
    walletBalance,
    walletTransactions,
    chargeWallet,
    refreshWallet,
    requestRefund,
  } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState("purchases");
  const [chargeOpen, setChargeOpen] = useState(false);
  const [amount, setAmount] = useState(500000);
  const [charging, setCharging] = useState(false);
  const [chargeMsg, setChargeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundSending, setRefundSending] = useState(false);
  const [refundMsg, setRefundMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Refresh the real wallet balance from the backend on mount / after charge.
  useEffect(() => {
    void refreshWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const walletStatus = params.get("wallet");

  if (!user) return null;

  const purchased = state.purchases.filter((p) => p.status === "موفق");
  const notes = state.notes;
  const tabs = [
    { id: "purchases", label: "سوابق خرید", count: purchased.length },
    { id: "wallet", label: "کیف پول", count: walletTransactions.length },
    { id: "progress", label: "پیشرفت آموزشی" },
    { id: "exams", label: "نمرات آزمون‌ها" },
    { id: "quiz", label: "تاریخچه کوییز" },
    { id: "community", label: "فعالیت کامیونیتی" },
    { id: "notes", label: "یادداشت‌ها", count: notes.length },
  ];

  const doRefundRequest = async () => {
    if (!refundFor) return;
    setRefundSending(true);
    setRefundMsg(null);
    const res = await requestRefund(refundFor, refundReason.trim() || undefined);
    setRefundSending(false);
    if (!res.ok) {
      setRefundMsg({ ok: false, text: res.error || "ثبت درخواست ناموفق بود." });
      return;
    }
    setRefundMsg({ ok: true, text: "درخواست شما ثبت شد و در انتظار بررسی مدیر است." });
    setTimeout(() => {
      setRefundFor(null);
      setRefundReason("");
      setRefundMsg(null);
    }, 1600);
  };

  const doCharge = async (a: number) => {
    setCharging(true);
    setChargeMsg(null);
    const res = await chargeWallet(a);
    setCharging(false);
    if (!res.ok) {
      setChargeMsg({ ok: false, text: res.error || "شارژ ناموفق بود." });
      return;
    }
    if (res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
      return;
    }
    setChargeMsg({ ok: true, text: `کیف پول شما به مبلغ ${price(a)} شارژ شد.` });
    setChargeOpen(false);
    void refreshWallet();
  };

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      {/* profile header */}
      <header className="flex items-center gap-4 px-1 pt-2">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-semibold leading-7">{user.name}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Smartphone size={13} /> <span dir="ltr">{toFa(user.phone)}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-muted">عضو از {formatDate(user.joinedAt)}</p>
        </div>
        {user.role === "admin" && (
          <span className="chip border border-warn/25 bg-warn/10 text-warn">مدیر</span>
        )}
      </header>

      {/* account */}
      <div className="tg-group lg:rounded-xl lg:shadow-card">
        <div className="tg-row">
          <span className="tg-row-icon text-warn">
            <Trophy size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">امتیاز کل</span>
          </span>
          <span className="tg-row-value">{toFa(user.points)}</span>
        </div>
        <div className="tg-row">
          <span className="tg-row-icon text-neon">
            <Flame size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">روزهای پیاپی</span>
          </span>
          <span className="tg-row-value">{toFa(user.streakDays)}</span>
        </div>
        <button onClick={() => navigate("/profile#support")} className="tg-row">
          <span className="tg-row-icon">
            <Headphones size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">پشتیبانی</span>
          </span>
          <ChevronLeft size={18} className="shrink-0 text-locked" />
        </button>
        <button onClick={() => navigate("/profile#legal")} className="tg-row">
          <span className="tg-row-icon">
            <FileText size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">قوانین و حریم خصوصی</span>
          </span>
          <ChevronLeft size={18} className="shrink-0 text-locked" />
        </button>
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="tg-row"
        >
          <span className="tg-row-icon text-danger">
            <LogOut size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title text-danger">خروج از حساب</span>
          </span>
        </button>
      </div>

      {/* level & xp */}
      <LevelCard xp={xp} level={level} />

      {/* wallet charge result (redirected back from the gateway) */}
      {walletStatus === "success" && (
        <div className="card flex items-center gap-3 border border-teal/25 p-5">
          <CheckCircle2 size={20} className="shrink-0 text-teal" />
          <p className="text-sm font-bold text-teal">
            شارژ کیف پول با موفقیت انجام شد و موجودی شما به‌روزرسانی شد.
          </p>
        </div>
      )}
      {walletStatus === "failed" && (
        <div className="card flex items-center gap-3 border border-danger/25 p-5">
          <XCircle size={20} className="shrink-0 text-danger" />
          <p className="text-sm font-bold text-danger">
            شارژ کیف پول موفق نبود؛ مبلغی کسر نشده است.
          </p>
        </div>
      )}

      {/* wallet */}
      <div className="tg-group lg:rounded-xl lg:shadow-card">
        <div className="tg-row">
          <span className="tg-row-icon text-teal">
            <Wallet size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">کیف پول</span>
            <span className="tg-row-sub">موجودی {price(walletBalance)}</span>
          </span>
          <button onClick={() => setChargeOpen((v) => !v)} className="btn-primary btn-sm shrink-0">
            <Plus size={15} /> شارژ
          </button>
        </div>

        {chargeOpen && (
          <div className="animate-fade-in border-t border-line px-4 py-4">
            <p className="mb-3 text-sm font-bold">مبلغ شارژ (تومان)</p>
            <div className="flex flex-wrap gap-2">
              {[200000, 500000, 1000000, 2000000].map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={cls(
                    "chip border px-4 py-2 text-xs transition-colors",
                    amount === p
                      ? "border-neon bg-neon/15 text-sky"
                      : "border-line/60 bg-surface text-muted hover:text-text"
                  )}
                >
                  {price(p)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="number"
                value={amount || ""}
                min={10000}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="input max-w-[180px]"
                placeholder="مبلغ دلخواه"
                dir="ltr"
                style={{ textAlign: "right" }}
              />
              <button
                onClick={() => void doCharge(amount)}
                disabled={charging || !amount || amount < 10000}
                className="btn-success btn-md"
              >
                {charging ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> در حال اتصال…
                  </>
                ) : (
                  <>پرداخت و شارژ</>
                )}
              </button>
            </div>
            {chargeMsg && (
              <p
                className={cls("mt-3 text-xs", chargeMsg.ok ? "text-teal" : "text-danger")}
                role="status"
              >
                {chargeMsg.text}
              </p>
            )}
            <p className="mt-3 text-[11px] leading-5 text-locked">
              حداقل مبلغ شارژ {price(10000)} است. پرداخت از طریق درگاه امن انجام می‌شود و موجودی
              بلافاصله پس از تأیید، به‌روزرسانی می‌شود.
            </p>
          </div>
        )}
      </div>

      {/* live match stats */}
      {matchStats.total > 0 && (
        <div className="tg-group lg:rounded-xl lg:shadow-card">
          <div className="tg-row">
            <span className="tg-row-icon text-neon">
              <Trophy size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">مسابقات زنده</span>
              <span className="tg-row-sub">
                {toFa(matchStats.total)} مسابقه · {toFa(matchStats.wins)} برد · بهترین مقام{" "}
                {toFa(matchStats.best ?? "")}
              </span>
            </span>
            <Link to="/quiz/live" className="btn-secondary btn-sm shrink-0">
              مسابقه جدید
            </Link>
          </div>
        </div>
      )}

      {/* discount banner */}
      {activeDiscount && (
        <div className="tg-group lg:rounded-xl lg:shadow-card">
          <div className="tg-row">
            <span className="tg-row-icon text-teal">
              <BadgePercent size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">تخفیف عملکردی ٪{toFa(activeDiscount.percent)}</span>
              <span className="tg-row-sub">
                فصل {toFa(chapters.find((c) => c.id === activeDiscount.chapterId)?.index ?? "")} ·{" "}
                تا {formatDate(activeDiscount.expiresAt)}
              </span>
            </span>
            <Link
              to={`/checkout/${activeDiscount.chapterId}`}
              className="btn-success btn-sm shrink-0"
            >
              استفاده
            </Link>
          </div>
        </div>
      )}

      {/* badges */}
      <div className="card p-5 sm:p-6">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <Award size={18} className="text-warn" /> نشان‌ها و دستاوردها
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {BADGES.map((b) => {
            const earned = earnedBadges.includes(b.id);
            return (
              <div
                key={b.id}
                title={`${b.description} — شرط: ${b.condition}`}
                className={cls(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3.5 text-center transition-all",
                  earned
                    ? "border-warn/30 bg-warn/10 shadow-[0_0_18px_rgba(245,166,35,0.12)]"
                    : "border-line/40 bg-surface2/30 opacity-45"
                )}
              >
                <span className="text-2xl">
                  {earned ? <BadgeGlyph id={b.id} size={22} /> : <Lock size={22} />}
                </span>
                <span className="text-[10px] font-bold leading-4">{b.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* tabs */}
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "purchases" && (
        <div className="space-y-2.5 animate-fade-in">
          {purchased.length === 0 ? (
            <EmptyState
              icon={<ReceiptIcon size={24} />}
              title="خریدی ثبت نشده است"
              text="فصل‌های پولی را خریداری کنید؛ سوابق و رسیدها اینجا ذخیره می‌شوند."
              action={
                <Link to="/chapters" className="btn-primary btn-md">
                  مشاهده فصل‌ها
                </Link>
              }
            />
          ) : (
            purchased.map((p) => (
              <div
                key={p.id}
                className="card flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-navy text-lg">
                    <PackGlyph id={chapters.find((c) => c.id === p.chapterId)?.id} size={18} />
                  </span>
                  <div>
                    <p className="font-bold">{p.chapterTitle}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(p.date)} • رسید: <span dir="ltr">{p.receiptId}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {p.discountLabel && (
                    <span className="chip border border-teal/25 bg-teal/10 text-teal">
                      {p.discountLabel}
                    </span>
                  )}
                  <div className="text-left">
                    <p className="text-xs text-muted line-through">
                      {toFa(p.basePrice.toLocaleString())} تومان
                    </p>
                    <p className="font-black text-teal">{toFa(p.price.toLocaleString())} تومان</p>
                  </div>
                  <Link to={`/receipt/${p.id}`} className="btn-ghost btn-sm">
                    <ReceiptIcon size={14} /> رسید
                  </Link>
                  {p.refundStatus === "pending" ? (
                    <span
                      className="chip border border-warn/25 bg-warn/10 text-warn"
                      title={p.refundReason || "بدون دلیل"}
                    >
                      <MessageSquareWarning size={12} className="ml-1 inline" />
                      در انتظار بررسی
                    </span>
                  ) : p.refundStatus === "rejected" ? (
                    <span
                      className="chip border border-danger/25 bg-danger/10 text-danger"
                      title={p.refundReason || "—"}
                    >
                      رد شد
                    </span>
                  ) : p.refundStatus === "refunded" ? (
                    <span className="chip border border-line/60 bg-surface2/50 text-locked">
                      مسترد شد
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setRefundFor(p.id);
                        setRefundReason("");
                        setRefundMsg(null);
                      }}
                      className="btn-ghost btn-sm !px-2.5 text-warn"
                      title="درخواست بازگشت وجه"
                    >
                      <RotateCcw size={14} /> بازگشت وجه
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {refundFor && (
        <div className="card border border-warn/25 p-5 animate-fade-in">
          <h3 className="flex items-center gap-2 font-bold text-warn">
            <RotateCcw size={17} /> درخواست بازگشت وجه
          </h3>
          <p className="mt-2 text-sm leading-7 text-muted">
            با ثبت درخواست، دسترسی شما به فصل تا بررسی مدیر حفظ می‌شود. پس از تأیید، مبلغ به درگاه
            یا کیف پول شما بازگردانده می‌شود.
          </p>
          <textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="input mt-3 w-full resize-none"
            placeholder="دلیل درخواست (اختیاری)…"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void doRefundRequest()}
              disabled={refundSending}
              className="btn-warn btn-md"
            >
              {refundSending ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> در حال ثبت…
                </>
              ) : (
                <>
                  <RotateCcw size={15} /> ثبت درخواست
                </>
              )}
            </button>
            <button
              onClick={() => {
                setRefundFor(null);
                setRefundReason("");
                setRefundMsg(null);
              }}
              className="btn-ghost btn-md"
            >
              انصراف
            </button>
          </div>
          {refundMsg && (
            <p
              role="status"
              className={cls("mt-3 text-xs", refundMsg.ok ? "text-teal" : "text-danger")}
            >
              {refundMsg.text}
            </p>
          )}
        </div>
      )}

      {tab === "wallet" && (
        <div className="space-y-2.5 animate-fade-in">
          {walletTransactions.length === 0 ? (
            <EmptyState
              icon={<Wallet size={24} />}
              title="تراکنشی ثبت نشده است"
              text="کیف پول را شارژ کنید یا با موجودی آن فصل بخرید؛ همه تراکنش‌ها اینجا ثبت می‌شوند."
              action={
                <button onClick={() => setChargeOpen(true)} className="btn-primary btn-md">
                  <Plus size={15} /> شارژ کیف پول
                </button>
              }
            />
          ) : (
            walletTransactions.map((t) => {
              const isIn = t.type === "charge" || t.type === "bonus";
              const label =
                t.type === "charge"
                  ? "شارژ کیف پول"
                  : t.type === "purchase"
                    ? "خرید فصل"
                    : t.type === "refund"
                      ? "بازگشت وجه"
                      : "هدیه";
              return (
                <div
                  key={t.id}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cls(
                        "grid h-10 w-10 place-items-center rounded-lg",
                        isIn ? "bg-teal/15 text-teal" : "bg-sky/15 text-sky"
                      )}
                    >
                      {isIn ? <ArrowDownLeft size={17} /> : <ArrowUpLeft size={17} />}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{label}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {t.description || label} • {formatDate(t.createdAt)}
                        {t.status === "failed" && (
                          <span className="mr-1 text-danger">(ناموفق)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className={cls("text-sm font-black", isIn ? "text-teal" : "text-sky")}>
                      {isIn ? "+" : "−"}
                      {toFa(t.amount.toLocaleString())} تومان
                    </p>
                    <p className="text-[11px] text-muted">موجودی: {price(t.balanceAfter)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === "progress" && (
        <div className="space-y-3 animate-fade-in">
          {chapters.map((ch) => {
            const p = chapterProgress(ch.id);
            const access =
              ch.free ||
              state.purchases.some((x) => x.chapterId === ch.id) ||
              state.accessGrants.includes(ch.id);
            return (
              <Link
                key={ch.id}
                to={`/chapters/${ch.id}`}
                className="card flex items-center gap-4 p-4 transition-colors hover:border-neon/40"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy text-lg">
                  {ch.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{ch.title}</p>
                    <span className={cls("chip hidden sm:inline-flex", levelStyles[ch.level])}>
                      {ch.level}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={p} className="flex-1" />
                    <span className="shrink-0 text-xs font-bold text-sky">{toFa(p)}٪</span>
                  </div>
                </div>
                {!access && <Lock size={16} className="shrink-0 text-locked" />}
                {access && p >= 100 && <CheckCircle2 size={18} className="shrink-0 text-teal" />}
              </Link>
            );
          })}
        </div>
      )}

      {tab === "exams" && (
        <div className="space-y-2.5 animate-fade-in">
          {state.examAttempts.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck size={24} />}
              title="آزمونی ثبت نشده است"
              text="بعد از تکمیل درس‌های هر فصل، در آزمون پایان فصل شرکت کنید."
              action={
                <Link to="/chapters" className="btn-primary btn-md">
                  رفتن به فصل‌ها
                </Link>
              }
            />
          ) : (
            state.examAttempts.map((a) => (
              <Link
                key={a.id}
                to={`/chapters/${a.chapterId}/exam/result/${a.id}`}
                className="card flex items-center justify-between gap-4 p-5 transition-colors hover:border-neon/40"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-surface2 text-sky">
                    <ClipboardCheck size={19} />
                  </span>
                  <div>
                    <p className="font-bold">{a.chapterTitle}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(a.date)} • {toFa(a.correct)} صحیح، {toFa(a.wrong)} غلط
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.awardedDiscount ? (
                    <span className="chip border border-teal/25 bg-teal/10 text-teal">
                      تخفیف ٪{toFa(a.awardedDiscount)}
                    </span>
                  ) : null}
                  <span
                    className={cls(
                      "chip text-sm",
                      a.passed
                        ? "border border-teal/25 bg-teal/10 text-teal"
                        : "border border-danger/25 bg-danger/10 text-danger"
                    )}
                  >
                    {toFa(a.score)} از ۱۰۰
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === "quiz" && (
        <div className="space-y-2.5 animate-fade-in">
          {state.quizAttempts.length === 0 ? (
            <EmptyState
              icon={<Gamepad2 size={24} />}
              title="کوییزی انجام نداده‌اید"
              text="با کوییز روزانه شروع کنید و امتیاز جمع کنید."
              action={
                <Link to="/quiz" className="btn-primary btn-md">
                  رفتن به کوییز
                </Link>
              }
            />
          ) : (
            state.quizAttempts.map((q) => (
              <div key={q.id} className="card flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface2 text-[#7C3AED]">
                    <Gamepad2 size={17} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{q.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{timeAgo(q.date)}</p>
                  </div>
                </div>
                <span className="chip border border-warn/25 bg-warn/10 text-warn">
                  {toFa(q.score)} از {toFa(q.total)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "community" && (
        <div className="space-y-2.5 animate-fade-in">
          {(() => {
            const myPosts = communityPosts.filter((p) => p.author.name === user.name);
            const myComments = communityComments.filter((c) => c.author.name === user.name);
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="card p-5">
                    <p className="text-2xl font-black text-sky">{toFa(myPosts.length)}</p>
                    <p className="text-xs text-muted">پست منتشرشده</p>
                  </div>
                  <div className="card p-5">
                    <p className="text-2xl font-black text-teal">{toFa(myComments.length)}</p>
                    <p className="text-xs text-muted">پاسخ ثبت‌شده</p>
                  </div>
                </div>
                {myPosts.length === 0 && (
                  <p className="card p-8 text-center text-sm text-muted">
                    هنوز پستی منتشر نکرده‌اید.{" "}
                    <Link to="/community" className="text-sky underline">
                      به کامیونیتی بروید
                    </Link>{" "}
                    و اولین پست خود را بسازید.
                  </p>
                )}
                {myPosts.map((p) => (
                  <Link
                    key={p.id}
                    to={`/community/${p.id}`}
                    className="card flex items-center justify-between gap-3 p-4 transition-colors hover:border-neon/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{p.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {p.category} • {timeAgo(p.createdAt)}
                      </p>
                    </div>
                    <ChevronLeft size={16} className="shrink-0 text-locked" />
                  </Link>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-2.5 animate-fade-in">
          {notes.length === 0 ? (
            <EmptyState
              icon={<StickyNote size={24} />}
              title="یادداشتی ندارید"
              text="در صفحه هر درس، دکمه «یادداشت» را بزنید تا نکات مهم را ذخیره کنید."
              action={
                <Link to="/chapters" className="btn-primary btn-md">
                  رفتن به فصل‌ها
                </Link>
              }
            />
          ) : (
            notes.map((n) => (
              <div key={n.id} className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-sky">{n.lessonTitle}</p>
                  <span className="flex items-center gap-1 text-[11px] text-locked">
                    <Clock size={11} /> {timeAgo(n.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted">{n.text}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* support & legal */}
      <div id="support" className="card scroll-mt-24 p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <Headphones size={18} className="text-sky" /> پشتیبانی
        </h2>
        <p className="text-sm leading-7 text-muted">
          سؤال یا مشکلی دارید؟ تیم پشتیبانی ایلیت همه‌روزه از ۹ تا ۲۱ پاسخگوی شماست.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a href="mailto:support@eliteai.academy" className="btn-secondary btn-md">
            <Headphones size={15} /> تیکت آنلاین
          </a>
          <button onClick={() => navigate("/community")} className="btn-secondary btn-md">
            <UserCircle2 size={15} /> سؤال در کامیونیتی
          </button>
        </div>
      </div>

      <div id="legal" className="card scroll-mt-24 p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <ShieldCheck size={18} className="text-teal" /> قوانین و حریم خصوصی
        </h2>
        <p className="text-sm leading-8 text-muted">
          محتوای پولی فقط برای کاربران دارای دسترسی نمایش داده می‌شود و دانلود یا بازنشر آن ممنوع
          است. اطلاعات شما محرمانه است و بدون رضایت شما در اختیار هیچ‌کس قرار نمی‌گیرد. تخفیف‌های
          عملکردی غیرقابل انتقال و محدود به حساب شما هستند.
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <BookOpen size={15} className="text-sky" />
          نسخه کامل قوانین و حریم خصوصی را از{" "}
          <button onClick={() => navigate("/")} className="text-sky underline">
            صفحه اصلی
          </button>{" "}
          در بخش پاورقی مطالعه کنید.
        </p>
      </div>
    </div>
  );
}
