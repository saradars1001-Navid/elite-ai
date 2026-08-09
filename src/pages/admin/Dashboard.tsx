import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CreditCard,
  BookOpen,
  TrendingUp,
  Trophy,
  ChevronLeft,
  ClipboardCheck,
  Gamepad2,
  Wrench,
  BarChart3,
  Flame,
} from "lucide-react";
import { useApp } from "../../lib/store";
import { backendAdminStats } from "../../lib/backend";
import { type AdminStats } from "../../lib/laravel-admin";
import { isLaravelConfigured } from "../../lib/laravel";
import { AdminHeader, StatCard, Badge, faNum } from "./AdminUI";
import { price, toFa, formatDate } from "../../lib/utils";
import { Progress } from "../../components/ui";

export default function AdminDashboard() {
  const { chapters, managedUsers, allPurchases, quizzes, aiTools, user } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const live = !!stats;

  useEffect(() => {
    if (!isLaravelConfigured()) return;
    let alive = true;
    backendAdminStats()
      .then((s) => alive && s && setStats(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // ── numbers: real DB aggregates when live, local collections in demo ──
  const revenue = live
    ? stats.sales.revenue
    : allPurchases.filter((p) => p.status === "موفق").reduce((a, p) => a + p.price, 0);
  const txCount = live ? stats.sales.orders : allPurchases.length;
  const paidTx = live
    ? stats.sales.paidOrders
    : allPurchases.filter((p) => p.status === "موفق").length;
  const userCount = live ? stats.progress.users : managedUsers.length;
  const activeUsers = live
    ? stats.progress.activeUsers
    : managedUsers.filter((u) => u.status === "فعال").length;
  const avgOrder = live ? stats.sales.avgOrder : txCount > 0 ? Math.round(revenue / txCount) : 0;

  const chapterRates = (live ? stats.progress.perChapter : []).map((c) => ({
    id: c.id,
    title: c.title,
    icon: c.icon || "📘",
    rate: c.completionRate,
  }));

  const recentPayments = live
    ? stats.sales.recent.map((p) => ({
        id: String(p.id),
        chapterTitle: p.chapterTitle,
        receiptId: p.receiptId,
        date: p.createdAt,
        price: p.price,
      }))
    : allPurchases.slice(0, 4);

  const topLearners = live ? stats.progress.topLearners : [];
  const people = live
    ? topLearners.map((u) => ({
        id: u.id,
        name: u.name,
        color: "#2F8CFF",
        meta: `روز پیاپی ${toFa(u.streak)}`,
        value: `${toFa(u.xp)} XP`,
        ok: true,
      }))
    : managedUsers.slice(0, 4).map((u) => ({
        id: u.id,
        name: u.name,
        color: u.color,
        meta: u.phone,
        value: u.status,
        ok: u.status === "فعال",
      }));
  const quizBoxes = live
    ? [
        { v: faNum(stats.quizzes.attempts), l: "تلاش کوییز" },
        { v: `${toFa(stats.quizzes.avgScore)}٪`, l: "میانگین نمره" },
        { v: `${toFa(stats.quizzes.passRate)}٪`, l: "نرخ قبولی" },
      ]
    : [
        { v: toFa(quizzes.length), l: "کوییز فعال" },
        { v: toFa(quizzes.reduce((a, q) => a + q.questions.length, 0)), l: "سؤال" },
        { v: toFa(quizzes.filter((q) => q.kind === "daily").length), l: "کوییز روزانه" },
      ];

  const dailySales = live ? stats.sales.daily : [];
  const maxDaily = dailySales.reduce((a, d) => Math.max(a, d.total), 0) || 1;

  return (
    <div>
      <AdminHeader
        title="داشبورد مدیریت"
        desc={
          live
            ? "آمار زنده از دیتابیس — فروش، پیشرفت و عملکرد کوییزها مستقیماً از MySQL خوانده می‌شوند"
            : "نمای زنده پلتفرم — داده‌های این صفحه از محتوای واقعی پلتفرم خوانده می‌شوند"
        }
      />

      {live && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="chip border border-teal/25 bg-teal/10 text-teal">
            <BarChart3 size={13} className="ml-1 inline" /> آمار زنده از بک‌اند
          </span>
          <span className="chip border border-line/60 bg-surface2/40 text-muted">
            {toFa(stats.progress.completedLessons)} درس تکمیل‌شده توسط{" "}
            {toFa(stats.progress.distinctLearners)} یادگیرنده
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="درآمد موفق تراکنش‌ها"
          value={price(revenue)}
          icon={CreditCard}
          tone="text-teal bg-teal/10"
          sub={`${toFa(paidTx)} موفق • ${toFa(txCount)} تراکنش`}
        />
        <StatCard
          label="کاربران ثبت‌شده"
          value={faNum(userCount)}
          icon={Users}
          tone="text-sky bg-sky/10"
          sub={
            live
              ? `${toFa(activeUsers)} فعال • ${toFa(stats.progress.newUsers30d)} جدید (۳۰ روز)`
              : `${toFa(activeUsers)} فعال`
          }
        />
        <StatCard
          label="فصل‌های آموزشی"
          value={faNum(chapters.length)}
          icon={BookOpen}
          tone="text-warn bg-warn/10"
          sub={`${toFa(chapters.filter((c) => !c.free).length)} پولی`}
        />
        <StatCard
          label="کوییزها و ابزارها"
          value={faNum(quizzes.length + aiTools.length)}
          icon={Gamepad2}
          tone="text-[#8B5CF6] bg-[#8B5CF6]/10"
          sub={
            live
              ? `${toFa(stats.quizzes.attempts)} تلاش کوییز`
              : `${toFa(quizzes.length)} کوییز • ${toFa(aiTools.length)} ابزار`
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* chapter completion */}
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <BookOpen size={18} className="text-sky" /> نرخ تکمیل فصل‌ها
          </h2>
          <div className="space-y-4">
            {(live
              ? chapterRates
              : chapters.map((c) => ({
                  id: c.id,
                  title: c.title,
                  icon: c.icon,
                  rate: c.completionRate,
                }))
            ).map((c) => (
              <div key={c.id}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {c.icon} {c.title}
                  </span>
                  <span className="text-xs text-muted">{toFa(c.rate)}٪</span>
                </div>
                <Progress
                  value={c.rate}
                  color={c.rate >= 60 ? "bg-teal" : c.rate >= 40 ? "bg-sky" : "bg-warn"}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          {/* recent payments */}
          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <CreditCard size={18} className="text-teal" /> آخرین پرداخت‌ها
              </h2>
              <Link to="/admin/payments" className="text-xs text-sky hover:underline">
                همه پرداخت‌ها
              </Link>
            </div>
            <div className="space-y-2.5">
              {recentPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{p.chapterTitle}</p>
                    <p className="truncate text-xs text-muted">
                      {p.receiptId} • {formatDate(p.date)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-teal">{price(p.price)}</span>
                </div>
              ))}
              {recentPayments.length === 0 && (
                <p className="rounded-lg border border-dashed border-line/60 p-5 text-center text-xs text-muted">
                  هنوز تراکنشی ثبت نشده است.
                </p>
              )}
            </div>
          </section>

          {/* quiz activity */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <Trophy size={18} className="text-warn" /> وضعیت کوییزها
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              {quizBoxes.map((s) => (
                <div key={s.l} className="rounded-lg border border-line/60 bg-surface2/40 py-3">
                  <p className="text-lg font-black text-sky">{s.v}</p>
                  <p className="text-[11px] text-muted">{s.l}</p>
                </div>
              ))}
            </div>
            {live && stats.quizzes.topScorers.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-xs font-bold text-muted">برترین‌های کوییز:</p>
                {stats.quizzes.topScorers.slice(0, 3).map((s, i) => (
                  <p
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-line/50 bg-surface2/40 px-3 py-2 text-xs"
                  >
                    <span className="font-medium">
                      {i + 1}. {s.name}
                    </span>
                    <span className="text-sky">{toFa(s.pct)}٪</span>
                  </p>
                ))}
              </div>
            )}
          </section>

          {/* top learners / recent users */}
          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold">
                <Users size={18} className="text-sky" /> {live ? "یادگیرندگان برتر" : "کاربران"}
              </h2>
              <Link to="/admin/users" className="text-xs text-sky hover:underline">
                مدیریت کاربران
              </Link>
            </div>
            <div className="space-y-2">
              {people.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white"
                      style={{ background: u.color }}
                    >
                      {u.name[0]}
                    </span>
                    <div>
                      <p className="text-sm font-bold">{u.name}</p>
                      {live ? (
                        <p className="text-[11px] text-muted">
                          <Flame size={11} className="ml-0.5 inline text-warn" /> {u.meta}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted" dir="ltr">
                          {u.meta}
                        </p>
                      )}
                    </div>
                  </div>
                  {live ? (
                    <span className="text-xs font-black text-sky">{u.value}</span>
                  ) : (
                    <Badge tone={u.ok ? "success" : "danger"}>{u.value}</Badge>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* daily sales sparkline (live only) */}
      {live && dailySales.length > 0 && (
        <section className="card mt-6 p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <TrendingUp size={18} className="text-teal" /> فروش ۱۴ روز اخیر{" "}
            <span className="text-xs font-normal text-muted">
              — میانگین سفارش {price(avgOrder)}
            </span>
          </h2>
          <div className="flex items-end gap-1.5" style={{ height: 96 }}>
            {dailySales.map((d) => (
              <div
                key={d.date}
                className="group flex flex-1 flex-col items-center justify-end gap-1"
                title={`${formatDate(d.date)}: ${toFa(d.count)} سفارش — ${price(d.total)}`}
              >
                <div
                  className="w-full rounded-t bg-teal/60 transition-colors group-hover:bg-teal"
                  style={{ height: `${Math.max(4, Math.round((d.total / maxDaily) * 80))}px` }}
                />
                <span className="text-[9px] text-locked">{new Date(d.date).getDate()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* quick links */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { to: "/admin/chapters", label: "مدیریت فصل‌ها", icon: BookOpen },
          { to: "/admin/quizzes", label: "کوییزها و تولید خودکار", icon: Gamepad2 },
          { to: "/admin/tools", label: "بانک ابزارها", icon: Wrench },
          { to: "/admin/settings", label: "تنظیمات و بانک سؤال", icon: TrendingUp },
        ].map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="card group flex items-center justify-between p-5 transition-colors hover:border-neon/40"
          >
            <span className="flex items-center gap-3 font-bold">
              <q.icon size={18} className="text-sky" /> {q.label}
            </span>
            <ChevronLeft
              size={16}
              className="text-locked transition-transform group-hover:-translate-x-1"
            />
          </Link>
        ))}
      </div>

      {user && (
        <p className="mt-6 rounded-lg border border-line/50 bg-surface2/40 p-4 text-xs leading-6 text-muted">
          <ClipboardCheck size={14} className="ml-1 inline text-sky" />
          ورود سریع مدیر فعال است؛ از منوی کاربر (بالا) هم می‌توانید به پنل مدیریت برگردید.
        </p>
      )}
    </div>
  );
}
