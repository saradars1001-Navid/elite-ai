import { ChGlyph } from "../lib/entityIcons";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ShieldCheck,
  BadgePercent,
  TicketPercent,
  CreditCard,
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Lock,
  ReceiptText,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { useApp } from "../lib/store";
import type { PurchaseRecord } from "../lib/types";
import { backendCreateCheckout, backendEnabled } from "../lib/backend";
import { isLaravelConfigured, laravelCreateCheckout } from "../lib/laravel";
import { cls, toFa, price, discountPercent } from "../lib/utils";
import { Banner, Modal } from "../components/ui";

type GateStatus = "idle" | "processing" | "success" | "failed" | "cancelled";

export default function Checkout() {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const {
    user,
    hasAccess,
    buyChapter,
    state,
    activeDiscount,
    chapters,
    coupons,
    walletBalance,
    refreshWallet,
  } = useApp();
  const ch = chapters.find((c) => c.id === chapterId);

  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gate, setGate] = useState<GateStatus>("idle");
  const [method, setMethod] = useState<"gateway" | "wallet">("gateway");
  const [receipt, setReceipt] = useState<{ id: string } | null>(null);
  const [backendPending, setBackendPending] = useState(false);
  const [serverPrice, setServerPrice] = useState<number | null>(null);
  const [serverLabel, setServerLabel] = useState("");
  const [failMsg, setFailMsg] = useState("");

  const discountCode = useMemo(() => {
    if (!couponMsg?.ok) return 0;
    const d = coupons[coupon.trim().toUpperCase()];
    return d ?? 0;
  }, [couponMsg, coupon, coupons]);

  if (!ch) {
    return <div className="container-x py-20 text-center text-muted">فصل پیدا نشد.</div>;
  }

  const alreadyOwned =
    ch.free ||
    hasAccess(ch.id) ||
    state.purchases.some((p) => p.chapterId === ch.id && p.status === "موفق");
  const perfDiscount = activeDiscount?.chapterId === ch.id ? activeDiscount.percent : 0;
  const baseDiscount = ch.oldPrice ? discountPercent(ch.oldPrice, ch.price) : 0;
  const finalPrice = Math.round((ch.price * (100 - perfDiscount - discountCode)) / 100);
  const walletEnough = walletBalance >= finalPrice;

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) {
      setCouponMsg({ ok: false, text: "کد تخفیف را وارد کنید." });
      return;
    }
    if (isLaravelConfigured()) {
      // In production the coupon is validated and priced on the server.
      setCouponMsg(null);
      const res = await laravelCreateCheckout(ch.id, code);
      if (res.error) {
        setCouponMsg({ ok: false, text: "کد تخفیف معتبر نیست یا منقضی شده است." });
        setServerPrice(null);
      } else {
        setCouponMsg({ ok: true, text: `کد ${code} در سرور تأیید شد.` });
        if (typeof res.amount === "number") {
          setServerPrice(res.amount);
          setServerLabel(`قیمت نهایی پس از تخفیف‌ها (محاسبه سرور)`);
        }
      }
      return;
    }
    if (coupons[code] !== undefined) {
      if (state.usedDiscountCodes.includes(code)) {
        setCouponMsg({ ok: false, text: "این کد قبلاً استفاده شده است." });
      } else {
        setCouponMsg({
          ok: true,
          text: `کد ${code} با موفقیت اعمال شد (٪${toFa(coupons[code])} تخفیف).`,
        });
      }
    } else {
      setCouponMsg({ ok: false, text: "کد تخفیف معتبر نیست. نمونه: ELITE10" });
    }
  };

  const pay = async () => {
    setGate("processing");
    if (method === "wallet" && !walletEnough) {
      setGate("failed");
      setFailMsg("موجودی کیف پول شما کافی نیست. لطفاً ابتدا کیف پول را شارژ کنید.");
      return;
    }
    if (backendEnabled()) {
      const result = await backendCreateCheckout(
        ch.id,
        couponMsg?.ok ? coupon.trim().toUpperCase() : undefined,
        method
      );
      if (result.ok && typeof result.amount === "number") {
        setServerPrice(result.amount);
        setServerLabel("قیمت نهایی تأییدشده توسط سرور");
      }
      if (!result.ok) {
        setGate("failed");
        setFailMsg(result.error || "پرداخت ناموفق بود");
        return;
      }
      // Wallet purchase is settled instantly on the server (balance deducted
      // inside a transaction); gateway purchases wait for the redirect.
      setBackendPending(!result.walletPaid);
      setGate("success");
      setReceipt(result.purchaseId ? { id: result.purchaseId } : null);
      if (result.walletPaid) {
        // Refresh balance so the UI reflects the deduction immediately.
        void refreshWallet();
      }
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
      return;
    }
    setTimeout(() => {
      setGate("success");
      let rec: PurchaseRecord;
      try {
        rec = buyChapter(
          ch.id,
          method === "gateway" ? "درگاه پرداخت" : "کیف پول",
          couponMsg?.ok ? coupon.trim().toUpperCase() : undefined
        );
      } catch (e) {
        setGate("failed");
        setFailMsg(e instanceof Error ? e.message : "پرداخت ناموفق بود");
        return;
      }
      setReceipt({ id: rec.id });
    }, 2200);
  };

  return (
    <div className="container-x max-w-4xl py-10 sm:py-14">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="مسیر">
        <Link to="/" className="hover:text-sky">
          خانه
        </Link>
        <ChevronLeft size={12} />
        <Link to="/chapters" className="hover:text-sky">
          فصل‌ها
        </Link>
        <ChevronLeft size={12} />
        <span className="text-text">خرید فصل {toFa(ch.index)}</span>
      </nav>

      <h1 className="mb-2 text-2xl font-black sm:text-3xl">خرید فصل</h1>
      <p className="mb-8 text-sm text-muted">بررسی جزئیات، اعمال تخفیف و پرداخت امن</p>

      {alreadyOwned ? (
        <div className="card p-8">
          <Banner
            kind="success"
            title="شما به این فصل دسترسی دارید"
            text="خرید تکراری ثبت نمی‌شود. می‌توانید از همین حالا یادگیری را شروع کنید."
          />
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => navigate(`/chapters/${ch.id}`)} className="btn-primary btn-md">
              رفتن به فصل
            </button>
            <Link to="/profile" className="btn-secondary btn-md">
              سوابق خرید
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* left: steps */}
          <div className="space-y-6">
            {/* step 1: review */}
            <section className="card p-6">
              <StepTitle n={1} title="بررسی جزئیات فصل" />
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-navy text-2xl">
                  <ChGlyph id={ch.id} size={20} />
                </span>
                <div className="min-w-0">
                  <p className="font-black">
                    فصل {toFa(ch.index)}: {ch.title}
                  </p>
                  <p className="mt-1 text-sm leading-7 text-muted">{ch.subtitle}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{toFa(ch.lessons.length)} درس ویدئویی و متنی</span>
                    <span>{toFa(ch.exercises.length)} تمرین عملی</span>
                    <span>آزمون پایان فصل</span>
                    <span>پروژه نهایی</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 flex items-center gap-2 rounded-lg border border-sky/20 bg-sky/5 px-4 py-3 text-xs leading-6 text-muted">
                <Sparkles size={14} className="shrink-0 text-sky" />
                پس از خرید، دسترسی شما به‌صورت آنی فعال می‌شود و تا ابد ماندگار است. تکمیل
                موفقیت‌آمیز فصل، مشمول تخفیف عملکردی برای فصل بعد می‌شود.
              </p>
            </section>

            {/* step 2: coupon */}
            <section className="card p-6">
              <StepTitle n={2} title="کد تخفیف" />
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <TicketPercent
                    size={16}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-locked"
                  />
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    placeholder="مثلاً ELITE10"
                    className="input !pr-10"
                    dir="ltr"
                    style={{ textAlign: "right" }}
                  />
                </div>
                <button onClick={applyCoupon} className="btn-secondary btn-md">
                  اعمال
                </button>
              </div>
              {couponMsg && (
                <p
                  className={cls("mt-2 text-xs", couponMsg.ok ? "text-teal" : "text-danger")}
                  role="status"
                >
                  {couponMsg.text}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.keys(coupons).map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCoupon(c);
                      applyCoupon();
                    }}
                    className="chip border border-line/60 bg-surface2/50 text-[11px] text-muted transition-colors hover:border-teal/40 hover:text-teal"
                    dir="ltr"
                  >
                    {c} (٪{toFa(coupons[c])})
                  </button>
                ))}
              </div>
            </section>

            {/* step 3: payment */}
            <section className="card p-6">
              <StepTitle n={3} title="پرداخت" />
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setMethod("gateway")}
                  className={cls(
                    "flex items-center gap-3 rounded-lg border p-4 text-right transition-colors",
                    method === "gateway"
                      ? "border-neon bg-neon/10"
                      : "border-line/60 bg-surface2/40 hover:border-neon/30"
                  )}
                >
                  <CreditCard
                    size={20}
                    className={method === "gateway" ? "text-sky" : "text-muted"}
                  />
                  <div>
                    <p className="text-sm font-bold">درگاه پرداخت آنلاین</p>
                    <p className="text-[11px] text-muted">زرین‌پال — کارت‌های عضو شتاب</p>
                  </div>
                </button>
                <button
                  onClick={() => setMethod("wallet")}
                  className={cls(
                    "flex items-center gap-3 rounded-lg border p-4 text-right transition-colors",
                    method === "wallet"
                      ? "border-neon bg-neon/10"
                      : "border-line/60 bg-surface2/40 hover:border-neon/30"
                  )}
                >
                  <Wallet size={20} className={method === "wallet" ? "text-sky" : "text-muted"} />
                  <div>
                    <p className="text-sm font-bold">کیف پول ایلیت</p>
                    <p className={cls("text-[11px]", walletEnough ? "text-teal" : "text-danger")}>
                      موجودی: {price(walletBalance)}
                      {!walletEnough && " — کافی نیست"}
                    </p>
                  </div>
                </button>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface2/40 px-4 py-3">
                <p className="flex items-center gap-2 text-sm text-muted">
                  <ShieldCheck size={16} className="text-teal" /> پرداخت امن با رمزنگاری SSL
                </p>
                <p className="text-xs text-muted">
                  {method === "wallet"
                    ? "موجودی کیف پول فقط برای خرید فصل استفاده می‌شود."
                    : "بازگشت وجه تا ۷ روز پس از خرید"}
                </p>
              </div>
            </section>
          </div>

          {/* right: summary */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="card p-6">
              <h3 className="mb-4 font-bold">خلاصه سفارش</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-muted">
                  <span>قیمت اصلی</span>
                  <span className="line-through">{price(ch.price)}</span>
                </div>
                {baseDiscount > 0 && (
                  <div className="flex justify-between text-muted">
                    <span>تخفیف فصل</span>
                    <span className="text-teal">-{toFa(baseDiscount)}٪</span>
                  </div>
                )}
                {perfDiscount > 0 && (
                  <div className="flex justify-between text-teal">
                    <span className="flex items-center gap-1.5">
                      <BadgePercent size={14} /> تخفیف عملکردی (نمره آزمون)
                    </span>
                    <span>-{toFa(perfDiscount)}٪</span>
                  </div>
                )}
                {discountCode > 0 && (
                  <div className="flex justify-between text-sky">
                    <span>کد تخفیف {coupon.toUpperCase()}</span>
                    <span>-{toFa(discountCode)}٪</span>
                  </div>
                )}
                {serverPrice !== null && serverLabel && (
                  <div className="flex justify-between text-teal">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={14} /> {serverLabel}
                    </span>
                  </div>
                )}
                <div className="border-t border-line/60 pt-3">
                  <div className="flex justify-between text-base font-black">
                    <span>مبلغ قابل پرداخت</span>
                    <span className="text-gradient">
                      {price(serverPrice !== null ? serverPrice : Math.max(0, finalPrice))}
                    </span>
                  </div>
                  {(serverPrice !== null ? serverPrice : finalPrice) <= 0 && (
                    <p className="mt-1 text-[11px] text-teal">مبلغ نهایی صفر شد — پرداخت رایگان!</p>
                  )}
                </div>
              </div>

              <button
                onClick={pay}
                disabled={gate === "processing" || gate === "success"}
                className={cls(
                  "btn-primary btn-lg mt-5 w-full",
                  (gate === "processing" || gate === "success") && "opacity-70"
                )}
              >
                {gate === "processing" ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> در حال اتصال به درگاه…
                  </>
                ) : gate === "success" ? (
                  <>
                    <CheckCircle2 size={18} /> پرداخت موفق
                  </>
                ) : (
                  <>
                    <Lock size={16} /> پرداخت و فعال‌سازی آنی
                  </>
                )}
              </button>

              <p className="mt-3 text-center text-[11px] leading-5 text-locked">
                با پرداخت، <button className="underline">قوانین و مقررات</button> را می‌پذیرید.
                {isLaravelConfigured()
                  ? "مبلغ نهایی توسط سرور محاسبه می‌شود."
                  : "مبلغ نهایی هنگام تأیید پرداخت محاسبه می‌شود."}
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* gateway modal */}
      <Modal open={gate === "processing"} onClose={() => {}} title="درگاه پرداخت">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="grid h-16 w-16 animate-pulse-soft place-items-center rounded-full bg-neon/15 text-neon">
            <CreditCard size={28} />
          </span>
          <p className="text-sm leading-7 text-muted">
            در حال انتقال به درگاه امن پرداخت…
            <br />
            مبلغ {price(serverPrice !== null ? serverPrice : Math.max(0, finalPrice))} از حساب شما
            کسر می‌شود.
          </p>
          {!backendEnabled() && (
            <div className="flex gap-3">
              <button onClick={() => setGate("failed")} className="btn-danger btn-sm">
                <XCircle size={14} /> پرداخت ناموفق
              </button>
              <button onClick={() => setGate("cancelled")} className="btn-ghost btn-sm">
                انصراف از پرداخت
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* result banners */}
      {gate === "failed" && (
        <div className="card mt-6 p-6">
          <Banner
            kind="error"
            title="پرداخت ناموفق بود"
            text={
              failMsg ||
              "مبلغی کسر نشده است. لطفاً دوباره تلاش کنید یا روش پرداخت دیگری انتخاب کنید."
            }
            onClose={() => setGate("idle")}
          />
          <button onClick={() => setGate("idle")} className="btn-primary btn-md mt-4">
            تلاش مجدد
          </button>
        </div>
      )}
      {gate === "cancelled" && (
        <div className="card mt-6 p-6">
          <Banner
            kind="warn"
            title="پرداخت لغو شد"
            text="سفارش شما ثبت نشده است. در صورت تمایل می‌توانید دوباره اقدام کنید."
            onClose={() => setGate("idle")}
          />
          <button onClick={() => setGate("idle")} className="btn-primary btn-md mt-4">
            بازگشت به پرداخت
          </button>
        </div>
      )}

      {/* success → receipt */}
      {gate === "success" && (
        <div className="card mt-6 border border-teal/25 p-6 animate-slide-up">
          <Banner
            kind={backendPending ? "info" : "success"}
            title={
              backendPending ? "سفارش ثبت شد و منتظر تأیید درگاه است" : "پرداخت با موفقیت انجام شد"
            }
            text={
              backendPending
                ? `شناسه سفارش: ${receipt?.id ?? "—"}. پس از تأیید پرداخت توسط درگاه، دسترسی فصل «${ch.title}» فعال می‌شود.`
                : `دسترسی شما به فصل «${ch.title}» فعال شد. رسید خرید صادر گردید.`
            }
          />
          <div className="mt-5 flex flex-wrap gap-3">
            {!backendPending && (
              <button onClick={() => navigate(`/chapters/${ch.id}`)} className="btn-primary btn-md">
                شروع یادگیری
              </button>
            )}
            {!backendPending && receipt && (
              <Link to={`/receipt/${receipt.id}`} className="btn-secondary btn-md">
                <ReceiptText size={15} /> مشاهده رسید
              </Link>
            )}
          </div>
        </div>
      )}

      {!user && gate !== "success" && !alreadyOwned && (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-bold">هنوز وارد نشده‌اید؟</p>
            <p className="mt-1 text-sm text-muted">برای خرید، حساب کاربری لازم است.</p>
          </div>
          <Link to="/auth" className="btn-primary btn-md">
            <ArrowLeft size={15} /> ورود / ثبت‌نام
          </Link>
        </div>
      )}
    </div>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h3 className="mb-4 flex items-center gap-2.5 font-bold">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-neon/15 text-sm font-black text-sky">
        {toFa(n)}
      </span>
      {title}
    </h3>
  );
}
