import { Link, useNavigate } from "react-router-dom";
import {
  PlayCircle,
  BadgePercent,
  Flame,
  Trophy,
  Award,
  Bell,
  ArrowLeft,
  BookOpen,
  Star,
  Clock,
  Users,
  ChevronLeft,
  Gauge,
} from "lucide-react";
import { BADGES } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, hours, percent, price, toFa, formatDate } from "../lib/utils";
import { Progress, Avatar, LevelCard, WeeklyChallengeWidget } from "../components/ui";

export default function Dashboard() {
  const {
    user,
    state,
    overallProgress,
    chapterProgress,
    activeDiscount,
    earnedBadges,
    unreadCount,
    hasAccess,
    xp,
    level,
    weeklyChallenge,
    claimWeeklyReward,
    chapters,
  } = useApp();
  const navigate = useNavigate();
  if (!user) return null;

  const purchased = state.purchases.filter((p) => p.status === "موفق");
  const ownedChapters = chapters.filter(
    (c) => c.free || hasAccess(c.id) || purchased.some((p) => p.chapterId === c.id)
  );
  const suggested = chapters.filter((c) => !ownedChapters.some((o) => o.id === c.id));

  // last visited lesson
  const allLessons = chapters.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c })));
  const lastCompleted = allLessons
    .filter((l) => state.lessonProgress[l.chapterId]?.[l.id])
    .sort((a, b) => b.index - a.index)[0];
  const continueTarget = lastCompleted
    ? { chapterId: lastCompleted.chapterId, lessonId: lastCompleted.id }
    : { chapterId: "ch1", lessonId: "ch1-l1" };

  const stats = [
    {
      icon: BookOpen,
      label: "پیشرفت کلی",
      value: percent(overallProgress),
      tone: "text-sky bg-sky/10",
    },
    { icon: Trophy, label: "امتیاز کلی", value: toFa(user.points), tone: "text-warn bg-warn/10" },
    {
      icon: Flame,
      label: "روزهای پیاپی",
      value: toFa(user.streakDays) + " روز",
      tone: "text-[#F97316] bg-[#F97316]/10",
    },
    {
      icon: BadgePercent,
      label: "تخفیف فعال",
      value: activeDiscount ? `٪${toFa(activeDiscount.percent)}` : "ندارید",
      tone: "text-teal bg-teal/10",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* welcome */}
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className="bg-grid absolute inset-0 opacity-60" />
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-neon/10 blur-[70px]" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div>
              <p className="text-sm text-muted">
                {new Date().getHours() < 12
                  ? "صبح بخیر"
                  : new Date().getHours() < 18
                    ? "ظهر بخیر"
                    : "عصر بخیر"}{" "}
                👋
              </p>
              <h1 className="text-xl font-black sm:text-2xl">{user.name}</h1>
              <p className="mt-0.5 text-xs text-muted">
                عضو از {formatDate(user.joinedAt)} —{" "}
                {user.role === "admin" ? "مدیر پلتفرم" : "یادگیرنده"}
              </p>
            </div>
          </div>
          <Link to="/profile" className="btn-secondary btn-md">
            مشاهده پروفایل
          </Link>
        </div>
      </div>

      {/* level card */}
      <LevelCard xp={xp} level={level} />

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 sm:p-5">
            <span className={cls("mb-3 grid h-10 w-10 place-items-center rounded-lg", s.tone)}>
              <s.icon size={19} />
            </span>
            <p className="text-xl font-black sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* continue learning */}
      {continueTarget && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line/60 bg-surface2/50 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-bold">ادامه یادگیری</h2>
              <p className="mt-0.5 text-xs text-muted">از جایی که بودید ادامه دهید</p>
            </div>
            <Link to="/chapters" className="btn-ghost btn-sm">
              همه فصل‌ها <ArrowLeft size={14} />
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-sky">
                  فصل {toFa(chapters.findIndex((c) => c.id === continueTarget.chapterId) + 1)}
                </span>
                <span className="text-muted">•</span>
                <span className="text-muted">
                  {lastCompleted?.title || "درس ۱: هوش مصنوعی چیست؟"}
                </span>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted">
                <span>پیشرفت فصل</span>
                <span className="font-bold text-sky">
                  {percent(chapterProgress(continueTarget.chapterId))}
                </span>
              </div>
              <Progress value={chapterProgress(continueTarget.chapterId)} className="max-w-sm" />
            </div>
            <button
              onClick={() =>
                navigate(`/chapters/${continueTarget.chapterId}/lessons/${continueTarget.lessonId}`)
              }
              className="btn-primary btn-lg shrink-0"
            >
              <PlayCircle size={19} /> ادامه یادگیری
            </button>
          </div>
        </div>
      )}

      {/* weekly challenge widget */}
      <WeeklyChallengeWidget challenges={weeklyChallenge.challenges} onClaim={claimWeeklyReward} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* owned chapters */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">فصل‌های من</h2>
            <Link to="/chapters" className="text-xs font-medium text-sky hover:underline">
              مشاهده همه
            </Link>
          </div>
          {ownedChapters.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              هنوز فصلی ندارید.{" "}
              <Link to="/chapters" className="text-sky underline">
                فصل اول رایگان را شروع کنید.
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {ownedChapters.slice(0, 3).map((ch) => (
                <Link
                  key={ch.id}
                  to={`/chapters/${ch.id}`}
                  className="flex items-center gap-3 rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-3 transition-colors hover:border-neon/40"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy text-lg">
                    {ch.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{ch.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={chapterProgress(ch.id)} className="h-1.5 flex-1" />
                      <span className="shrink-0 text-[10px] text-muted">
                        {percent(chapterProgress(ch.id))}
                      </span>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="text-locked" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* suggested */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">پیشنهادی برای شما</h2>
            <Link to="/chapters" className="text-xs font-medium text-sky hover:underline">
              همه فصل‌ها
            </Link>
          </div>
          <div className="space-y-3">
            {suggested.slice(0, 3).map((ch) => (
              <Link
                key={ch.id}
                to={`/chapters/${ch.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-3 transition-colors hover:border-neon/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy text-lg">
                    {ch.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{ch.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                      <Clock size={11} /> {hours(ch.duration)} •{" "}
                      <Star size={11} className="fill-warn text-warn" />
                      {toFa(ch.rating)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-black text-neon">
                  {ch.free ? "رایگان" : price(ch.price)}
                </span>
              </Link>
            ))}
            {suggested.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">
                همه فصل‌ها را در اختیار دارید! 🎉
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* exam scores */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Gauge size={17} className="text-sky" />
            <h2 className="font-bold">نتایج آزمون‌ها</h2>
          </div>
          {state.examAttempts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              هنوز آزمونی نداده‌اید. بعد از تکمیل درس‌های هر فصل، در آزمون پایان فصل شرکت کنید.
            </p>
          ) : (
            <div className="space-y-2.5">
              {state.examAttempts.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  to={`/chapters/${a.chapterId}/exam/result/${a.id}`}
                  className="flex items-center justify-between rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-3 transition-colors hover:border-neon/40"
                >
                  <div>
                    <p className="text-sm font-bold">{a.chapterTitle}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {toFa(a.correct)} صحیح • {toFa(a.wrong)} غلط • {formatDate(a.date)}
                    </p>
                  </div>
                  <span
                    className={cls(
                      "chip",
                      a.passed
                        ? "border border-teal/25 bg-teal/10 text-teal"
                        : "border border-danger/25 bg-danger/10 text-danger"
                    )}
                  >
                    {a.score} از ۱۰۰
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* badges */}
        <section className="card p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Award size={17} className="text-warn" />
            <h2 className="font-bold">نشان‌ها و دستاوردها</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {BADGES.slice(0, 8).map((b) => {
              const earned = earnedBadges.includes(b.id);
              return (
                <div
                  key={b.id}
                  title={b.description}
                  className={cls(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                    earned
                      ? "border-warn/30 bg-warn/10"
                      : "border-line/50 bg-surface2/30 opacity-50"
                  )}
                >
                  <span className="text-xl">{earned ? b.icon : "🔒"}</span>
                  <span className="text-[10px] font-bold leading-4">{b.title}</span>
                </div>
              );
            })}
          </div>
          <Link
            to="/profile"
            className="mt-4 block text-center text-xs font-medium text-sky hover:underline"
          >
            مشاهده همه نشان‌ها
          </Link>
        </section>
      </div>

      {/* notifications + community strip */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Link
          to="/notifications"
          className="card group flex items-center justify-between p-5 transition-colors hover:border-neon/40 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-lg bg-neon/10 text-neon">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {toFa(unreadCount)}
                </span>
              )}
            </span>
            <div>
              <p className="font-bold">اعلان‌ها</p>
              <p className="text-xs text-muted">
                {unreadCount > 0
                  ? `${toFa(unreadCount)} اعلان خوانده‌نشده دارید`
                  : "همه را خوانده‌اید"}
              </p>
            </div>
          </div>
          <ChevronLeft
            size={18}
            className="text-locked transition-transform group-hover:-translate-x-1"
          />
        </Link>
        <Link
          to="/community"
          className="card group flex items-center justify-between p-5 transition-colors hover:border-neon/40 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal/10 text-teal">
              <Users size={20} />
            </span>
            <div>
              <p className="font-bold">کامیونیتی</p>
              <p className="text-xs text-muted">پرسش، پاسخ و اشتراک تجربه</p>
            </div>
          </div>
          <ChevronLeft
            size={18}
            className="text-locked transition-transform group-hover:-translate-x-1"
          />
        </Link>
      </div>
    </div>
  );
}
