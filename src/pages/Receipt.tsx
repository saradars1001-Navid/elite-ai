import { PackGlyph } from "../lib/entityIcons";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Printer, ArrowRight, ShieldCheck, ReceiptText } from "lucide-react";
import { useApp } from "../lib/store";
import { toFa, price, formatDate } from "../lib/utils";
import { EmptyState } from "../components/ui";

export default function Receipt() {
  const { purchaseId } = useParams();
  const { state, chapters } = useApp();
  const rec = state.purchases.find((p) => p.id === purchaseId);

  if (!rec) {
    return (
      <div className="container-x py-20">
        <EmptyState
          icon={<ReceiptText size={26} />}
          title="رسید پیدا نشد"
          text="رسید درخواستی در سوابق شما وجود ندارد."
          action={
            <Link to="/profile" className="btn-primary btn-md">
              سوابق خرید
            </Link>
          }
        />
      </div>
    );
  }

  const ch = chapters.find((c) => c.id === rec.chapterId);

  return (
    <div className="container-x max-w-xl py-12">
      <div className="card overflow-hidden">
        {/* header */}
        <div className="border-b border-line/60 bg-surface2/50 p-6 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-teal/15 text-teal">
            <CheckCircle2 size={24} />
          </span>
          <h1 className="text-xl font-black">پرداخت موفق</h1>
          <p className="mt-1 text-xs text-muted">
            مبلغ پرداختی: <b className="text-teal">{price(rec.price)}</b> — {formatDate(rec.date)}
          </p>
        </div>

        {/* body */}
        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex items-start gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy text-2xl">
              <PackGlyph id={ch?.id} size={18} />
            </span>
            <div>
              <p className="font-black">
                فصل {toFa(ch?.index ?? 0)}: {rec.chapterTitle}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {ch
                  ? `${toFa(ch.lessons.length)} درس، ${toFa(ch.exercises.length)} تمرین، آزمون و پروژه نهایی`
                  : ""}
              </p>
            </div>
          </div>

          <dl className="space-y-2.5 rounded-lg border border-line/60 bg-surface2/40 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">شماره رسید</dt>
              <dd className="font-bold" dir="ltr">
                {rec.receiptId}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">تاریخ خرید</dt>
              <dd>{formatDate(rec.date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">روش پرداخت</dt>
              <dd>{rec.discountLabel ? "درگاه پرداخت" : "درگاه پرداخت"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">قیمت اصلی</dt>
              <dd className="line-through text-muted">{price(rec.basePrice)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">تخفیف</dt>
              <dd className="text-teal">{rec.discountLabel || "—"}</dd>
            </div>
            <div className="flex justify-between border-t border-line/60 pt-2.5 text-base">
              <dt className="font-bold">مبلغ نهایی</dt>
              <dd className="font-black text-teal">{price(rec.price)}</dd>
            </div>
          </dl>

          <p className="flex items-start gap-2 rounded-lg border border-line/60 bg-surface2/40 px-4 py-3 text-[11px] leading-6 text-muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-teal" />
            این رسید به‌صورت دیجیتال صادر شده و در صورت نیاز می‌توانید از پروفایل کاربری آن را
            مجدداً مشاهده کنید.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to={`/chapters/${rec.chapterId}`} className="btn-primary btn-md flex-1">
              <ArrowRight size={15} /> شروع یادگیری
            </Link>
            <button onClick={() => window.print()} className="btn-secondary btn-md">
              <Printer size={15} /> چاپ رسید
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
