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
  quiz: { label: "کوییز", icon: Gamepad2, color: "text-[#8B5CF6] bg-[#8B5CF6]/10" },
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
    <div className="container-x max-w-3xl py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">اعلان‌ها</span>
          <h1 className="text-2xl font-black sm:text-3xl">اعلان‌ها</h1>
          <p className="mt-2 text-sm text-muted">
            {unreadCount > 0
              ? `${toFa(unreadCount)} اعلان خوانده‌نشده دارید`
              : "همه اعلان‌ها را خوانده‌اید"}
          </p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className={cls("btn-secondary btn-md", unreadCount === 0 && "opacity-50")}
        >
          <CheckCheck size={16} /> علامت‌گذاری همه به‌عنوان خوانده‌شده
        </button>
      </div>

      {/* filters */}
      <div className="no-scrollbar mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cls(
              "shrink-0 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors",
              filter === f
                ? "border-neon/50 bg-neon/15 text-sky"
                : "border-line/60 bg-surface text-muted hover:text-text"
            )}
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
        <div className="space-y-2.5">
          {list.map((n) => {
            const meta = TYPE_META[n.type];
            return (
              <button
                key={n.id}
                onClick={() => {
                  markOneRead(n.id);
                  setDetail(n);
                }}
                className={cls(
                  "flex w-full items-start gap-3.5 rounded-lg border p-4 text-right transition-colors hover:border-neon/40",
                  n.read ? "border-line/40 bg-surface/60" : "border-neon/25 bg-surface"
                )}
              >
                <span
                  className={cls(
                    "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                    meta.color
                  )}
                >
                  <meta.icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {!n.read && <span className="h-2 w-2 rounded-full bg-neon" aria-hidden />}
                    <span className={cls("text-sm font-bold", n.read ? "text-muted" : "text-text")}>
                      {n.title}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-6 text-muted">{n.body}</span>
                  <span className="mt-1.5 block text-[11px] text-locked">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                <ChevronLeft size={16} className="mt-2 shrink-0 text-locked" />
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
