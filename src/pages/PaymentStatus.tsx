import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Clock3,
  ReceiptText,
  Home,
} from "lucide-react";
import { useApp } from "../lib/store";
import { toFa, price, formatDate } from "../lib/utils";
import type { PurchaseRecord } from "../lib/types";

export default function PaymentStatus() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshPurchaseStatus, state, chapters } = useApp();
  const purchaseId = params.get("purchase");
  const initialStatus = params.get("status") || "pending";

  const [syncState, setSyncState] = useState<"loading" | "done">(purchaseId ? "loading" : "done");
  const [record, setRecord] = useState<PurchaseRecord | null>(null);

  useEffect(() => {
    if (!purchaseId || !user) {
      setSyncState("done");
      return;
    }
    let alive = true;
    (async () => {
      await refreshPurchaseStatus(purchaseId);
      if (!alive) return;
      const found = state.purchases.find((p) => p.id === purchaseId);
      setRecord(found ?? null);
      setSyncState("done");
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId, user?.id]);

  const status =
    record?.status ??
    (initialStatus === "success" ? "موفق" : initialStatus === "failed" ? "ناموفق" : "در انتظار");
  const ch = record ? chapters.find((c) => c.id === record.chapterId) : undefined;

  if (!user) {
    return (
      <div className="container-x max-w-xl py-16 text-center">
        <p className="mb-5 text-sm text-muted">برای مشاهده نتیجه پرداخت وارد شوید.</p>
        <button onClick={() => navigate("/auth")} className="btn-primary btn-md">
          ورود / ثبت‌نام
        </button>
      </div>
    );
  }

  return (
    <div className="container-x max-w-xl py-12">
      <div className="card relative overflow-hidden p-8 text-center sm:p-10">
        {syncState === "loading" ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 size={30} className="animate-spin text-neon" />
            <p className="text-sm text-muted">در حال بررسی وضعیت پرداخت…</p>
          </div>
        ) : status === "موفق" ? (
          <>
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-teal/15 text-teal">
              <CheckCircle2 size={30} />
            </span>
            <span className="chip mb-3 border border-teal/25 bg-teal/10 text-teal">
              پرداخت موفق
            </span>
            <h1 className="text-2xl font-black">دسترسی شما فعال شد 🎉</h1>
            <p className="mt-2 text-sm leading-7 text-muted">
              خرید فصل «{record?.chapterTitle || ch?.title || "..."}» با موفقیت ثبت شد و دسترسی آنی
              است.
            </p>

            {record && (
              <dl className="mx-auto mt-6 max-w-xs space-y-2.5 rounded-lg border border-line/60 bg-surface2/40 p-4 text-sm text-right">
                <div className="flex justify-between">
                  <dt className="text-muted">شناسه رسید</dt>
                  <dd className="font-bold" dir="ltr">
                    {record.receiptId}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">تاریخ</dt>
                  <dd>{formatDate(record.date)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">مبلغ</dt>
                  <dd className="font-black text-teal">{price(record.price)}</dd>
                </div>
              </dl>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {record && (
                <Link to={`/chapters/${record.chapterId}`} className="btn-primary btn-md">
                  <ArrowRight size={15} /> شروع یادگیری
                </Link>
              )}
              {record && (
                <Link to={`/receipt/${record.id}`} className="btn-secondary btn-md">
                  <ReceiptText size={15} /> رسید خرید
                </Link>
              )}
              <Link to="/" className="btn-ghost btn-md">
                <Home size={15} /> خانه
              </Link>
            </div>
          </>
        ) : status === "در انتظار" ? (
          <>
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-warn/15 text-warn">
              <Clock3 size={30} />
            </span>
            <h1 className="text-2xl font-black">در انتظار تأیید پرداخت</h1>
            <p className="mt-2 text-sm leading-7 text-muted">
              سفارش شما ثبت شده و به‌محض تأیید درگاه، دسترسی فعال می‌شود. این صفحه را رفرش کنید یا
              کمی بعد مراجعه کنید.
            </p>
            {record && (
              <p className="mt-4 text-xs text-muted">
                شناسه سفارش: <b dir="ltr">{record.receiptId}</b>
              </p>
            )}
          </>
        ) : (
          <>
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-danger/15 text-danger">
              <XCircle size={30} />
            </span>
            <h1 className="text-2xl font-black">پرداخت موفق نبود</h1>
            <p className="mt-2 text-sm leading-7 text-muted">
              مبلغی کسر نشده است. در صورت تمایل دوباره تلاش کنید یا با پشتیبانی در تماس باشید.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/chapters" className="btn-primary btn-md">
                بازگشت به فصل‌ها
              </Link>
              <Link to="/profile" className="btn-secondary btn-md">
                سوابق خرید
              </Link>
            </div>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-[11px] text-locked">
        {toFa(user.phone ? user.phone.slice(-4) : "")} — خریدار: {user.name}
      </p>
    </div>
  );
}
