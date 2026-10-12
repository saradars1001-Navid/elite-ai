import { useEffect, useState } from "react";
import {
  CreditCard,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  Activity,
  MessageSquareWarning,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useApp } from "../../lib/store";
import {
  backendAdminPaymentEvents,
  backendAdminRefundApprove,
  backendAdminRefundReject,
  backendAdminRefundRequests,
  backendRefundPurchase,
} from "../../lib/backend";
import { isLaravelConfigured } from "../../lib/laravel";
import type { AdminPaymentEvent, AdminRefundRequest } from "../../lib/laravel-admin";
import { AdminHeader, Table, Td, TRow, Badge, faNum } from "./AdminUI";
import { price, formatDate, timeAgo } from "../../lib/utils";
import { Modal } from "../../components/ui";

const eventTone: Record<AdminPaymentEvent["status"], "success" | "danger" | "warn" | "default"> = {
  processed: "success",
  idempotent: "warn",
  received: "default",
  ignored: "default",
  failed: "danger",
};

const eventStatusLabel: Record<AdminPaymentEvent["status"], string> = {
  processed: "پردازش‌شده",
  idempotent: "تکراری (بی‌اثر)",
  received: "دریافت‌شده",
  ignored: "نادیده‌گرفته",
  failed: "ناموفق",
};

export default function AdminPayments() {
  const { allPurchases, updatePurchase, state, setPurchaseRefund } = useApp();
  const [filter, setFilter] = useState("همه");
  const [tab, setTab] = useState<"tx" | "events" | "refunds">("tx");
  const [events, setEvents] = useState<AdminPaymentEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [refund, setRefund] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [flashText, setFlashText] = useState("وضعیت پرداخت به‌روزرسانی شد.");
  const [refundTab, setRefundTab] = useState<"pending" | "done">("pending");
  const [refundRequests, setRefundRequests] = useState<AdminRefundRequest[] | null>(null);
  const [refundRequestsLoading, setRefundRequestsLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [refundReqError, setRefundReqError] = useState("");

  // Load the payment event audit log from the Laravel API when the tab opens.
  useEffect(() => {
    if (tab !== "events" || !isLaravelConfigured() || events !== null) return;
    setEventsLoading(true);
    backendAdminPaymentEvents()
      .then((list) => list && setEvents(list))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, [tab, events]);

  // Load pending/done refund requests from the Laravel API.
  useEffect(() => {
    if (tab !== "refunds") return;
    setRefundRequestsLoading(true);
    backendAdminRefundRequests(refundTab)
      .then((list) => setRefundRequests(list))
      .catch(() => setRefundRequests(null))
      .finally(() => setRefundRequestsLoading(false));
  }, [tab, refundTab]);

  const flash = (msg = "وضعیت پرداخت به‌روزرسانی شد.") => {
    setSaved(true);
    setFlashText(msg);
    setTimeout(() => setSaved(false), 1800);
  };

  const list = allPurchases.filter((p) => filter === "همه" || p.status === filter);
  const userPhone = state.user?.phone;

  return (
    <div>
      <AdminHeader
        title="مدیریت پرداخت‌ها"
        desc="وضعیت تراکنش‌ها، رسیدها، بازگشت وجه و لاگ رویدادهای درگاه"
      />

      <div className="mb-5 flex gap-1.5">
        {[
          { id: "tx" as const, label: "تراکنش‌ها", icon: CreditCard },
          { id: "refunds" as const, label: "درخواست‌های بازگشت وجه", icon: MessageSquareWarning },
          { id: "events" as const, label: "رویدادهای پرداخت", icon: Activity },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold transition-colors ${
              tab === t.id
                ? "border-neon/50 bg-neon/15 text-sky"
                : "border-line/60 bg-surface text-muted hover:text-text"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {saved && (
        <div className="card mb-6 border border-teal/25 p-4 text-sm text-teal animate-fade-in">
          {flashText}
        </div>
      )}

      {tab === "events" ? (
        <EventsTable
          events={events}
          loading={eventsLoading}
          expanded={expanded}
          onToggle={(id) => setExpanded((s) => ({ ...s, [id]: !s[id] }))}
        />
      ) : tab === "refunds" ? (
        <>
          {refundReqError && (
            <div className="card mb-5 border border-danger/30 p-4 text-sm text-danger animate-fade-in">
              {refundReqError}
            </div>
          )}
          <RefundRequestsTable
            loading={refundRequestsLoading}
            items={refundRequests}
            statusTab={refundTab}
            onStatusTab={setRefundTab}
            actingId={actingId}
            rejectReason={rejectReason}
            onRejectReason={(id, v) => setRejectReason((s) => ({ ...s, [id]: v }))}
            onApprove={async (id) => {
              setActingId(id);
              const res = isLaravelConfigured()
                ? await backendAdminRefundApprove(id)
                : { ok: true };
              setActingId(null);
              if (!res.ok) {
                setRefundReqError(res.error || "تأیید بازگشت وجه ناموفق بود.");
                return;
              }
              setRefundReqError("");
              setPurchaseRefund(id, { refundStatus: "refunded" });
              setRefundRequests((list) => (list ?? []).filter((r) => r.id !== id));
              flash("درخواست تأیید و بازگشت وجه ثبت شد.");
            }}
            onReject={async (id) => {
              setActingId(id);
              const res = isLaravelConfigured()
                ? await backendAdminRefundReject(id, rejectReason[id] || undefined)
                : { ok: true };
              setActingId(null);
              if (!res.ok) {
                setRefundReqError(res.error || "رد درخواست ناموفق بود.");
                return;
              }
              setRefundReqError("");
              setPurchaseRefund(id, { refundStatus: "rejected" });
              setRefundRequests((list) => (list ?? []).filter((r) => r.id !== id));
              flash("درخواست رد شد و دسترسی کاربر حفظ شد.");
            }}
          />
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-1.5">
            {["همه", "موفق", "در انتظار", "ناموفق", "لغوشده"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                  filter === f
                    ? "border-neon/50 bg-neon/15 text-sky"
                    : "border-line/60 bg-surface text-muted hover:text-text"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <Table head={["رسید", "کاربر", "فصل", "مبلغ", "تخفیف", "تاریخ", "وضعیت", "اقدام"]}>
            {list.map((p) => (
              <TRow key={p.id}>
                <Td className="font-mono text-xs" dir="ltr">
                  {p.receiptId}
                </Td>
                <Td className="font-bold">
                  {p.id.startsWith("seed-") ? "کاربر پلتفرم" : userPhone || "کاربر فعلی"}
                </Td>
                <Td className="text-muted">{p.chapterTitle}</Td>
                <Td>
                  <p className="font-bold">{price(p.price)}</p>
                  {p.basePrice !== p.price && (
                    <p className="text-[10px] text-muted line-through">{price(p.basePrice)}</p>
                  )}
                </Td>
                <Td className="text-xs text-teal">{p.discountLabel || "—"}</Td>
                <Td className="text-xs text-muted">{formatDate(p.date)}</Td>
                <Td>
                  <select
                    value={p.status}
                    onChange={(e) => {
                      updatePurchase(p.id, e.target.value as typeof p.status);
                      flash();
                    }}
                    className="input !w-28 !py-1.5 text-xs"
                    aria-label="وضعیت پرداخت"
                  >
                    <option>موفق</option>
                    <option>در انتظار</option>
                    <option>ناموفق</option>
                    <option>لغوشده</option>
                  </select>
                </Td>
                <Td>
                  {p.status === "موفق" ? (
                    <button
                      onClick={() => setRefund(p.id)}
                      className="btn-ghost btn-sm !px-2 text-warn"
                      title="بازگشت وجه"
                    >
                      <RotateCcw size={14} />
                    </button>
                  ) : (
                    <span className="text-[11px] text-locked">—</span>
                  )}
                </Td>
              </TRow>
            ))}
            {list.length === 0 && (
              <div className="py-8 text-center text-sm text-muted">
                تراکنشی با این وضعیت وجود ندارد.
              </div>
            )}
          </Table>

          <div className="tg-group mt-4 sm:max-w-2xl">
            {[
              {
                l: "تراکنش موفق",
                v: faNum(allPurchases.filter((p) => p.status === "موفق").length),
              },
              {
                l: "در انتظار",
                v: faNum(allPurchases.filter((p) => p.status === "در انتظار").length),
              },
              { l: "ناموفق", v: faNum(allPurchases.filter((p) => p.status === "ناموفق").length) },
              { l: "لغوشده", v: faNum(allPurchases.filter((p) => p.status === "لغوشده").length) },
            ].map((s) => (
              <div key={s.l} className="tg-row">
                <span className="tg-row-body">
                  <span className="tg-row-title">{s.l}</span>
                </span>
                <span className="shrink-0 text-lg font-black text-sky">{s.v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={!!refund} onClose={() => setRefund(null)} title="بازگشت وجه">
        <div className="space-y-4">
          <p className="flex items-start gap-2.5 rounded-lg border border-warn/30 bg-warn/10 p-4 text-sm leading-7 text-warn">
            <CreditCard size={17} className="mt-0.5 shrink-0" />
            بازگشت وجه به‌صورت آنی به حساب خریدار انجام می‌شود و دسترسی فصل او لغو می‌گردد. این عمل
            غیرقابل بازگشت است.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setRefund(null)} className="btn-secondary btn-md flex-1">
              انصراف
            </button>
            <button
              disabled={refunding}
              onClick={async () => {
                setRefunding(true);
                setRefundError("");
                if (isLaravelConfigured()) {
                  // In production the refund is reversed at the payment gateway
                  // and persisted in MySQL by the Laravel API.
                  const res = await backendRefundPurchase(refund!);
                  if (!res.ok) {
                    setRefunding(false);
                    setRefundError(res.error || "بازگشت وجه ناموفق بود.");
                    return;
                  }
                }
                updatePurchase(refund!, "لغوشده");
                setRefunding(false);
                setRefund(null);
                flash("بازگشت وجه ثبت شد.");
              }}
              className="btn-danger btn-md flex-1"
            >
              <RotateCcw size={15} /> تأیید بازگشت وجه
            </button>
          </div>
          {refundError && (
            <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              {refundError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function RefundRequestsTable({
  loading,
  items,
  statusTab,
  onStatusTab,
  actingId,
  rejectReason,
  onRejectReason,
  onApprove,
  onReject,
}: {
  loading: boolean;
  items: AdminRefundRequest[] | null;
  statusTab: "pending" | "done";
  onStatusTab: (t: "pending" | "done") => void;
  actingId: string | null;
  rejectReason: Record<string, string>;
  onRejectReason: (id: string, v: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-3 p-10 text-sm text-muted">
        <Loader2 size={18} className="animate-spin text-sky" /> در حال دریافت درخواست‌ها…
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="card p-8 text-center text-sm leading-7 text-muted">
        <MessageSquareWarning size={22} className="mx-auto mb-3 text-locked" />
        این بخش با اتصال به سرویس‌دهنده فعال می‌شود — درخواست‌های بازگشت وجه کاربران اینجا بررسی و
        تأیید یا رد می‌شوند.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {[
          { id: "pending" as const, label: "در انتظار بررسی" },
          { id: "done" as const, label: "بررسی‌شده" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => onStatusTab(t.id)}
            className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
              statusTab === t.id
                ? "border-neon/50 bg-neon/15 text-sky"
                : "border-line/60 bg-surface text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          {statusTab === "pending"
            ? "درخواست در انتظار بررسی وجود ندارد."
            : "هنوز درخواستی بررسی نشده است."}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{r.chapterTitle}</p>
                    <span className="chip border border-line/60 bg-surface2/50 text-xs">
                      {r.userName}
                    </span>
                    <span className="text-[11px] text-locked" dir="ltr">
                      {r.userPhone}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    رسید <span dir="ltr">{r.receiptId}</span> • {price(r.price)} • درخواست:{" "}
                    {r.refundRequestedAt ? timeAgo(r.refundRequestedAt) : formatDate(r.createdAt)}
                  </p>
                  {r.refundReason && (
                    <p className="mt-2 rounded-lg border border-line/50 bg-surface2/40 p-3 text-xs leading-6 text-muted">
                      <span className="font-bold text-text">دلیل کاربر: </span>
                      {r.refundReason}
                    </p>
                  )}
                </div>
                <span
                  className={`chip ${
                    r.refundStatus === "refunded"
                      ? "border border-teal/25 bg-teal/10 text-teal"
                      : r.refundStatus === "rejected"
                        ? "border border-danger/25 bg-danger/10 text-danger"
                        : "border border-warn/25 bg-warn/10 text-warn"
                  }`}
                >
                  {r.refundStatus === "refunded"
                    ? "مسترد شد"
                    : r.refundStatus === "rejected"
                      ? "رد شد"
                      : "در انتظار"}
                </span>
              </div>

              {r.refundStatus === "pending" && (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line/40 pt-4">
                  <button
                    disabled={actingId === r.id}
                    onClick={() => onApprove(r.id)}
                    className="btn-success btn-md"
                  >
                    {actingId === r.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}{" "}
                    تأیید و بازگشت وجه
                  </button>
                  <input
                    value={rejectReason[r.id] ?? ""}
                    onChange={(e) => onRejectReason(r.id, e.target.value)}
                    placeholder="دلیل رد (اختیاری)…"
                    className="input !w-56 !py-2 text-xs"
                  />
                  <button
                    disabled={actingId === r.id}
                    onClick={() => onReject(r.id)}
                    className="btn-danger btn-md"
                  >
                    {actingId === r.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <XCircle size={15} />
                    )}{" "}
                    رد درخواست
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsTable({
  events,
  loading,
  expanded,
  onToggle,
}: {
  events: AdminPaymentEvent[] | null;
  loading: boolean;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-3 p-10 text-sm text-muted">
        <Activity size={18} className="animate-pulse text-sky" /> در حال دریافت لاگ رویدادها…
      </div>
    );
  }

  if (events === null) {
    return (
      <div className="card p-8 text-center text-sm leading-7 text-muted">
        <Activity size={22} className="mx-auto mb-3 text-locked" />
        لاگ رویدادها با اتصال به سرویس‌دهنده فعال می‌شود.
        <br />
        همه وب‌هوک‌ها و callbackهای درگاه اینجا ثبت و قابل بازبینی می‌شوند.
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        هنوز رویدادی ثبت نشده است — اولین وب‌هوک یا callback درگاه پس از اولین پرداخت اینجا ظاهر
        می‌شود.
      </div>
    );
  }

  return (
    <Table head={["زمان", "منبع", "نوع", "مرجع", "وضعیت", "جزئیات"]}>
      {events.map((e) => {
        const open = !!expanded[String(e.id)];
        return (
          <EventsRow key={e.id} event={e} open={open} onToggle={() => onToggle(String(e.id))} />
        );
      })}
    </Table>
  );
}

function EventsRow({
  event: e,
  open,
  onToggle,
}: {
  event: AdminPaymentEvent;
  open: boolean;
  onToggle: () => void;
}) {
  const hasDetail = e.payload || e.verifyResult || e.error;
  return (
    <>
      <TRow className="cursor-pointer" onClick={onToggle}>
        <Td className="text-xs text-muted">{formatDate(e.createdAt)}</Td>
        <Td>
          <span className="chip border border-line/60 bg-surface2/50 text-xs">
            {e.source === "webhook" ? "وب‌هوک" : "Callback"}
          </span>
        </Td>
        <Td className="text-xs">{e.type === "refund" ? "بازگشت وجه" : "پرداخت"}</Td>
        <Td className="text-xs text-muted" dir="ltr">
          {e.referenceType ? `${e.referenceType}:${e.referenceId}` : "—"}
        </Td>
        <Td>
          <Badge tone={eventTone[e.status]}>{eventStatusLabel[e.status]}</Badge>
        </Td>
        <Td className="text-left">
          {hasDetail ? (
            <span className="inline-flex items-center gap-1 text-xs text-sky">
              {open ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}{" "}
              {open ? "بستن" : "مشاهده"}
            </span>
          ) : (
            <span className="text-[11px] text-locked">—</span>
          )}
        </Td>
      </TRow>
      {open && hasDetail && (
        <TRow className="border-t-0">
          <Td colSpan={6} className="!bg-surface/50">
            <div className="space-y-3 text-xs leading-6">
              {e.error && (
                <p className="rounded-lg border border-danger/25 bg-danger/10 p-3 text-danger">
                  خطا: {e.error}
                </p>
              )}
              {e.verifyResult && (
                <JsonBlock title="نتیجه تأیید درگاه (verify)" data={e.verifyResult} />
              )}
              {e.payload && <JsonBlock title="Payload دریافتی" data={e.payload} />}
            </div>
          </Td>
        </TRow>
      )}
    </>
  );
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div>
      <p className="mb-1 font-bold text-sky">{title}</p>
      <pre
        className="max-h-56 overflow-auto rounded-lg border border-line/50 bg-surface2/60 p-3 font-mono text-[11px] leading-5 text-muted"
        dir="ltr"
        style={{ textAlign: "left" }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
