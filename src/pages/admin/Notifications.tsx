import { useState } from "react";
import { Bell, Send, Trash2, Loader2 } from "lucide-react";
import { useApp } from "../../lib/store";
import { backendAdminSendNotification } from "../../lib/backend";
import { isLaravelConfigured } from "../../lib/laravel";
import { AdminHeader, Badge } from "./AdminUI";
import { toFa, timeAgo } from "../../lib/utils";
import { Modal } from "../../components/ui";
import type { NotificationItem } from "../../lib/types";

/** گزینه‌های مخاطب به کلید audience سمت API لاراول. */
const AUDIENCE_KEYS: Record<string, "all" | "chapter-buyers" | "active-30d" | "no-purchase"> = {
  "همه کاربران": "all",
  "خریداران فصل ۲": "chapter-buyers",
  "کاربران فعال (۳۰ روز اخیر)": "active-30d",
  "کاربران بدون خرید": "no-purchase",
};

const TYPE_LABEL: Record<NotificationItem["type"], string> = {
  chapter: "انتشار فصل جدید",
  lesson: "به‌روزرسانی درس",
  quiz: "اعلام کوییز جدید",
  discount: "تخفیف",
  exam: "نتیجه آزمون",
  badge: "دریافت نشان",
  community: "پاسخ کامیونیتی",
  support: "پیام پشتیبانی",
  payment: "پرداخت",
};

export default function AdminNotifications() {
  const { state, addNotification, updateNotifications } = useApp();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<NotificationItem["type"]>("chapter");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("همه کاربران");
  const [sent, setSent] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    // In Laravel mode the backend creates one row per active non-admin user
    // (scoped by audience) and returns the real recipient count.
    if (isLaravelConfigured()) {
      const res = await backendAdminSendNotification({
        type,
        title: title.trim(),
        body: body.trim(),
        link: undefined,
        audience: AUDIENCE_KEYS[audience] ?? "all",
        chapterId: audience === "خریداران فصل ۲" ? "ch2" : undefined,
      });
      setSending(false);
      if (!res) {
        setSent({ msg: "ارسال اعلان ناموفق بود.", ok: false });
        return;
      }
      addNotification({ type, title: title.trim(), body: body.trim(), link: undefined });
      setOpen(false);
      setTitle("");
      setBody("");
      setSent({
        msg: `اعلان برای ${toFa(res.recipients.toLocaleString("fa-IR"))} کاربر واقعی ارسال شد.`,
        ok: true,
      });
      setTimeout(() => setSent(null), 4000);
      return;
    }
    // Demo mode — local row only (no real recipients exist).
    addNotification({ type, title: title.trim(), body: body.trim(), link: undefined });
    setOpen(false);
    setTitle("");
    setBody("");
    setSending(false);
    setSent({ msg: `اعلان شما برای ${audience} ثبت شد (حالت نمایشی).`, ok: true });
    setTimeout(() => setSent(null), 3000);
  };

  return (
    <div>
      <AdminHeader
        title="مدیریت اعلان‌ها"
        desc="ارسال اعلان عمومی یا گروهی و مدیریت اعلان‌های قبلی"
        action={
          <button onClick={() => setOpen(true)} className="btn-primary btn-md">
            <Send size={15} /> اعلان جدید
          </button>
        }
      />

      {sent && (
        <div
          className={`card mb-6 border p-4 text-sm animate-fade-in ${
            sent.ok ? "border-teal/25 text-teal" : "border-danger/30 text-danger"
          }`}
        >
          {sent.ok ? "✓ " : "✕ "}
          {sent.msg}
        </div>
      )}

      <div className="space-y-2.5">
        {state.notifications.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">اعلانی وجود ندارد.</div>
        )}
        {state.notifications.slice(0, 12).map((n) => (
          <div key={n.id} className="card flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={n.read ? "default" : "info"}>{TYPE_LABEL[n.type]}</Badge>
                {!n.read && <span className="h-2 w-2 rounded-full bg-neon" />}
                <span className="text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-1.5 font-bold">{n.title}</p>
              <p className="mt-0.5 text-sm text-muted">{n.body}</p>
            </div>
            <button
              onClick={() => updateNotifications(state.notifications.filter((x) => x.id !== n.id))}
              className="btn-ghost btn-sm shrink-0 !px-2 text-danger"
              aria-label="حذف اعلان"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Bell size={14} className="text-sky" />
        در نسخه کامل، اعلان‌ها به‌صورت درون‌برنامه‌ای (WebSocket) و پیامکی (SMS) ارسال می‌شوند و
        برای گروه‌های هدف (خریداران یک فصل، کاربران فعال و…) قابل شخصی‌سازی هستند.
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title="ارسال اعلان جدید" wide>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">نوع اعلان</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NotificationItem["type"])}
                className="input"
              >
                {(Object.keys(TYPE_LABEL) as NotificationItem["type"][]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">مخاطب</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="input"
              >
                <option>همه کاربران</option>
                <option>خریداران فصل ۲</option>
                <option>کاربران فعال (۳۰ روز اخیر)</option>
                <option>کاربران بدون خرید</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">عنوان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="مثلاً: فصل جدید منتشر شد"
            />
          </div>
          <div>
            <label className="label">متن پیام</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="input resize-none"
              placeholder="متن کامل اعلان…"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {isLaravelConfigured()
                ? "پس از ارسال، تعداد واقعی دریافت‌کنندگان (کاربران فعال غیرادمین) گزارش می‌شود."
                : "حالت نمایشی: بدون اتصال به API، فقط برای حساب فعلی ثبت می‌شود."}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setOpen(false)} className="btn-secondary btn-md">
                انصراف
              </button>
              <button
                onClick={() => void send()}
                disabled={!title.trim() || !body.trim() || sending}
                className="btn-primary btn-md"
              >
                {sending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> در حال ارسال…
                  </>
                ) : (
                  <>
                    <Send size={15} /> ارسال اعلان
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
