import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, MessageSquareText, Check, Loader2 } from "lucide-react";
import { useApp } from "../lib/store";
import { validateIranPhone, toFa } from "../lib/utils";
import { Logo } from "../components/ui";

type Step = "phone" | "otp" | "name";

export default function Auth() {
  const { requestOtp, verifyOtp, user } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState(["", "", "", "", ""]);
  const [codeErr, setCodeErr] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [welcome, setWelcome] = useState(false);
  // Local development only: the API hands the SMS code back while the SMS
  // provider is disabled, so the sign-in flow stays testable end to end.
  const [devCode, setDevCode] = useState("");

  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Don't auto-navigate while the first-login name step is showing; the user
  // must be able to finish registering before entering the dashboard.
  useEffect(() => {
    if (user && step !== "name") navigate("/dashboard", { replace: true });
  }, [user, navigate, step]);

  useEffect(() => {
    if (!countdown) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const submitPhone = async () => {
    const digits = phone.replace(/[\s-]/g, "");
    if (!validateIranPhone(digits)) {
      setPhoneErr("شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹");
      return;
    }
    setPhoneErr("");
    setSending(true);
    const res = await requestOtp(digits);
    setSending(false);
    if (!res.ok) {
      setPhoneErr(res.error || "ارسال کد با خطا مواجه شد");
      return;
    }
    setDevCode(res.debugCode ?? "");
    setCountdown(60);
    setStep("otp");
  };

  const changePhone = () => {
    setStep("phone");
    setCode(["", "", "", "", ""]);
    setCodeErr("");
  };

  const handleCodeChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) {
      // paste: fill all boxes
      const digits = d.slice(0, 5).split("");
      const next = ["", "", "", "", ""];
      digits.forEach((ch, idx) => (next[idx] = ch));
      setCode(next);
      const lastIdx = Math.min(digits.length, 4);
      codeRefs.current[Math.max(0, lastIdx - 1)]?.focus();
      if (next.every((x) => x)) submitCode(next.join(""));
      return;
    }
    const next = [...code];
    next[i] = d;
    setCode(next);
    if (d && i < 4) codeRefs.current[i + 1]?.focus();
    if (next.every((x) => x)) submitCode(next.join(""));
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
  };

  const submitCode = async (fullCode?: string) => {
    const c = fullCode || code.join("");
    if (c.length < 5) {
      setCodeErr("لطفاً کد ۵ رقمی را کامل وارد کنید");
      return;
    }
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 600));
    const res = await verifyOtp(c);
    setVerifying(false);
    if (!res.ok) {
      setCodeErr(res.error || "خطا در تأیید کد");
      setCode(["", "", "", "", ""]);
      codeRefs.current[0]?.focus();
      return;
    }
    if (res.needsName) {
      setStep("name");
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  const submitName = async () => {
    if (name.trim().length < 3) {
      setNameErr("لطفاً نام و نام خانوادگی خود را وارد کنید");
      return;
    }
    setNameErr("");
    const res = await verifyOtp("12345", name.trim());
    if (res.ok) {
      setWelcome(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 1400);
    } else {
      setNameErr(res.error || "خطا در ثبت نام");
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="bg-grid absolute inset-0" />
      <div className="absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-neon/10 blur-[100px]" />

      <div className="card relative w-full max-w-md p-7 sm:p-9 animate-slide-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          {step === "phone" && (
            <p className="mt-5 text-sm leading-7 text-muted">
              برای ورود یا ساخت حساب، شماره موبایل خود را وارد کنید.
              <br />
              رمز عبور لازم نیست — فقط با کد پیامکی.
            </p>
          )}
        </div>

        {step === "phone" && (
          <div className="space-y-5">
            <div>
              <label htmlFor="phone" className="label">
                شماره موبایل
              </label>
              <div className="relative">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-locked">
                  +۹۸
                </span>
                <input
                  id="phone"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="912 345 6789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitPhone()}
                  className="input !pr-16 text-center text-lg tracking-widest"
                />
              </div>
              {phoneErr && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {phoneErr}
                </p>
              )}
            </div>
            <button onClick={submitPhone} disabled={sending} className="btn-primary btn-lg w-full">
              {sending ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> در حال ارسال کد…
                </>
              ) : (
                <>
                  دریافت کد تأیید <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center">
              <span className="chip mb-3 border border-teal/25 bg-teal/10 text-teal">
                <MessageSquareText size={13} /> کد ارسال شد
              </span>
              <p className="text-sm text-muted">
                کد ۵ رقمی به شماره{" "}
                <b className="text-text" dir="ltr">
                  {toFa(phone)}
                </b>{" "}
                پیامک شد.
              </p>
            </div>
            <div className="flex justify-center gap-2.5" dir="ltr">
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (codeRefs.current[i] = el)}
                  inputMode="numeric"
                  value={d}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleKey(i, e)}
                  className="input h-14 w-12 !p-0 text-center text-xl font-black"
                  aria-label={`رقم ${i + 1} کد`}
                />
              ))}
            </div>
            {codeErr && (
              <p className="text-center text-xs text-danger" role="alert">
                {codeErr}
              </p>
            )}
            {import.meta.env.DEV && devCode && (
              <p className="rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-center text-[11px] leading-5 text-warn">
                حالت توسعه (پیامک غیرفعال): کد تأیید <b dir="ltr">{devCode}</b> است.
              </p>
            )}
            <button
              onClick={() => submitCode()}
              disabled={verifying}
              className="btn-primary btn-lg w-full"
            >
              {verifying ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> در حال بررسی…
                </>
              ) : (
                "تأیید و ورود"
              )}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                onClick={changePhone}
                className="font-medium text-muted transition-colors hover:text-sky"
              >
                تغییر شماره
              </button>
              {countdown > 0 ? (
                <span className="text-muted">
                  ارسال مجدد تا{" "}
                  <b className="text-text" dir="ltr">
                    {toFa(countdown)}
                  </b>{" "}
                  ثانیه
                </span>
              ) : (
                <button onClick={submitPhone} className="font-medium text-sky hover:underline">
                  ارسال مجدد کد
                </button>
              )}
            </div>
          </div>
        )}

        {step === "name" && (
          <div className="space-y-5 animate-fade-in">
            {!welcome ? (
              <>
                <div className="text-center">
                  <span className="chip mb-3 border border-sky/25 bg-sky/10 text-sky">
                    <Check size={13} /> حساب شما آماده است
                  </span>
                  <p className="text-sm text-muted">
                    برای تکمیل ثبت‌نام، نام و نام خانوادگی خود را وارد کنید.
                  </p>
                </div>
                <div>
                  <label htmlFor="name" className="label">
                    نام و نام خانوادگی
                  </label>
                  <input
                    id="name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitName()}
                    placeholder="مثلاً: سارا محمدی"
                    className="input"
                  />
                  {nameErr && (
                    <p className="mt-2 text-xs text-danger" role="alert">
                      {nameErr}
                    </p>
                  )}
                </div>
                <button onClick={submitName} className="btn-primary btn-lg w-full">
                  تکمیل ثبت‌نام
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-teal">
                  <Check size={30} />
                </span>
                <h3 className="font-bold">خوش آمدید!</h3>
                <p className="text-sm text-muted">در حال انتقال به داشبورد…</p>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] leading-5 text-locked">
          <ShieldCheck size={13} className="text-teal" />
          اطلاعات شما محرمانه است و فقط برای تأیید هویت استفاده می‌شود.
        </p>
      </div>
    </div>
  );
}
