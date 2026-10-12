import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  BookOpen,
  RefreshCw,
  Gamepad2,
  BadgePercent,
  ClipboardCheck,
  Award,
  Users,
  Headphones,
  ChevronLeft,
  Inbox,
  CreditCard,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, toFa, timeAgo } from "../lib/utils";
import { Modal, EmptyState } from "../components/ui";
import type { NotificationItem } from "../lib/types";

const TYPE_META: Record<
  NotificationItem["type"],
  { label: string; icon: React.ElementType; color: string }
> = {
  chapter: { label: "فصل جدید", icon: BookOpen, color: "text-sky bg-sky/10" },
  lesson: { label: "به‌روزرسانی درس", icon: RefreshCw, color: "text-sky bg-sky/10" },
  quiz: { label: "کوییز", icon: Gamepad2, color: "text-[#7C3AED] bg-[#7C3AED]/10" },
  discount: { label: "تخفیف", icon: BadgePercent, color: "text-teal bg-teal/10" },
  exam: { label: "نتیجه آزمون", icon: ClipboardCheck, color: "text-warn bg-warn/10" },
  badge: { label: "نشان", icon: Award, color: "text-warn bg-warn/10" },
  community: { label: "کامیونیتی", icon: Users, color: "text-teal bg-teal/10" },
  support: { label: "پشتیبانی", icon: Headphones, color: "text-muted bg-surface2" },
  payment: { label: "پرداخت", icon: CreditCard, color: "text-sky bg-sky/10" },
};

export default function Notifications() {
  const { state, markAllRead, markOneRead, unreadCount } = useApp();
  const [filter, setFilter] = useState("همه");
  const [detail, setDetail] = useState<NotificationItem | null>(null);

  const list = useMemo(() => {
    let l = state.notifications;
    if (filter === "خوانده‌نشده") l = l.filter((n) => !n.read);
    if (filter === "خوانده‌شده") l = l.filter((n) => n.read);
    if (filter !== "همه" && !["خوانده‌نشده", "خوانده‌شده"].includes(filter))
      l = l.filter((n) => n.type === filter);
    return l;
  }, [state.notifications, filter]);

  const filters = ["همه", "خوانده‌نشده", "فصل جدید", "کوییز", "تخفیف", "نتیجه آزمون", "کامیونیتی"];

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-4">
      <header className="flex items-end justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-8 max-lg:hidden">اعلان‌ها</h1>
          <p className="mt-1 text-[13px] text-muted">
            {unreadCount > 0 ? `${toFa(unreadCount)} اعلان خوانده‌نشده` : "همه را خوانده‌اید"}
          </p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="btn-secondary btn-sm shrink-0"
        >
          <CheckCheck size={15} /> خواندن همه
        </button>
      </header>

      {/* filters */}
      <div className="tg-tabs -mx-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cls("tg-tab-item", filter === f && "active")}
          >
            {f}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Inbox size={26} />}
          title="اعلانی وجود ندارد"
          text="در این دسته اعلانی ندارید. فعالیت‌های جدید شما اینجا نمایش داده می‌شوند."
        />
      ) : (
        <div className="tg-group mt-3 max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
          {list.map((n) => {
            const meta = TYPE_META[n.type];
            return (
              <button
                key={n.id}
                onClick={() => {
                  markOneRead(n.id);
                  setDetail(n);
                }}
                className="tg-row items-start"
              >
                <span
                  className={cls(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                    meta.color
                  )}
                >
                  <meta.icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {!n.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-neon" aria-hidden />
                    )}
                    <span className={cls("tg-row-title", n.read && "text-muted")}>{n.title}</span>
                  </span>
                  <span className="tg-row-sub">{n.body}</span>
                  <span className="mt-0.5 block text-[11px] text-locked">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                <ChevronLeft size={16} className="mt-1 shrink-0 text-locked" />
              </button>
            );
          })}
        </div>
      )}

      {/* detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="جزئیات اعلان">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={cls(
                  "grid h-11 w-11 place-items-center rounded-lg",
                  TYPE_META[detail.type].color
                )}
              >
                {(() => {
                  const I = TYPE_META[detail.type].icon;
                  return <I size={19} />;
                })()}
              </span>
              <div>
                <p className="font-bold">{detail.title}</p>
                <p className="text-xs text-muted">
                  {TYPE_META[detail.type].label} • {timeAgo(detail.createdAt)}
                </p>
              </div>
            </div>
            <p className="text-sm leading-8 text-muted">{detail.body}</p>
            {detail.link ? (
              <Link
                to={detail.link}
                onClick={() => setDetail(null)}
                className="btn-primary btn-md w-full"
              >
                مشاهده <Bell size={15} />
              </Link>
            ) : (
              <p className="rounded-lg border border-line/60 bg-surface2/40 px-4 py-3 text-xs text-muted">
                این اعلان به صفحه خاصی لینک ندارد.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
