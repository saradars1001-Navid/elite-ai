import { ChGlyph, BadgeGlyph } from "../lib/entityIcons";
import { Link } from "react-router-dom";
import {
  Lock,
  PlayCircle,
  BadgePercent,
  Flame,
  Trophy,
  Award,
  Bell,
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
import { Avatar, LevelCard, WeeklyChallengeWidget } from "../components/ui";

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
      <div className="tg-group max-lg:-mx-1">
        {stats.map((s) => (
          <div key={s.label} className="tg-row">
            <span className={cls("tg-row-icon !h-10 !w-10", s.tone)}>
              <s.icon size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">{s.label}</span>
            </span>
            <span className="tg-row-value text-base font-black text-text">{s.value}</span>
          </div>
        ))}
      </div>

      {/* continue learning */}
      {continueTarget && (
        <section>
          <div className="tg-group-title flex items-center justify-between max-lg:mx-3">
            <span>ادامه یادگیری</span>
            <Link to="/chapters" className="text-xs font-medium text-sky">
              همه فصل‌ها
            </Link>
          </div>
          <div className="tg-group max-lg:-mx-1">
            <Link
              to={`/chapters/${continueTarget.chapterId}/lessons/${continueTarget.lessonId}`}
              className="tg-row"
            >
              <span className="tg-row-icon !h-11 !w-11 bg-neon/10 text-neon">
                <PlayCircle size={20} />
              </span>
              <span className="tg-row-body">
                <span className="tg-row-title">
                  {lastCompleted?.title || "درس ۱: هوش مصنوعی چیست؟"}
                </span>
                <span className="tg-row-sub">
                  فصل {toFa(chapters.findIndex((c) => c.id === continueTarget.chapterId) + 1)} ·
                  پیشرفت {percent(chapterProgress(continueTarget.chapterId))}
                </span>
                <span className="tg-rail">
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, chapterProgress(continueTarget.chapterId)))}%`,
                    }}
                  />
                </span>
              </span>
              <ChevronLeft size={16} className="shrink-0 text-locked" />
            </Link>
          </div>
        </section>
      )}

      {/* weekly challenge widget */}
      <WeeklyChallengeWidget challenges={weeklyChallenge.challenges} onClaim={claimWeeklyReward} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* owned chapters */}
        <section>
          <div className="tg-group-title flex items-center justify-between max-lg:mx-3">
            <span>فصل‌های من</span>
            <Link to="/chapters" className="text-xs font-medium text-sky">
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
            <div className="tg-group max-lg:-mx-1">
              {ownedChapters.slice(0, 3).map((ch) => (
                <Link key={ch.id} to={`/chapters/${ch.id}`} className="tg-row">
                  <span className="tg-row-icon !h-10 !w-10 bg-navy">
                    <ChGlyph id={ch.id} size={18} />
                  </span>
                  <span className="tg-row-body">
                    <span className="tg-row-title">{ch.title}</span>
                    <span className="tg-rail">
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(0, chapterProgress(ch.id)))}%`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="tg-row-value">{percent(chapterProgress(ch.id))}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* suggested */}
        <section>
          <div className="tg-group-title flex items-center justify-between max-lg:mx-3">
            <span>پیشنهادی برای شما</span>
            <Link to="/chapters" className="text-xs font-medium text-sky">
              همه فصل‌ها
            </Link>
          </div>
          <div className="tg-group max-lg:-mx-1">
            {suggested.slice(0, 3).map((ch) => (
              <Link key={ch.id} to={`/chapters/${ch.id}`} className="tg-row">
                <span className="tg-row-icon !h-10 !w-10 bg-navy">
                  <ChGlyph id={ch.id} size={18} />
                </span>
                <span className="tg-row-body">
                  <span className="tg-row-title">{ch.title}</span>
                  <span className="tg-row-sub flex items-center gap-1">
                    <Clock size={11} /> {hours(ch.duration)} •{" "}
                    <Star size={11} className="fill-warn text-warn" />
                    {toFa(ch.rating)}
                  </span>
                </span>
                <span className="tg-row-value font-black text-neon">
                  {ch.free ? "رایگان" : price(ch.price)}
                </span>
              </Link>
            ))}
            {suggested.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">همه فصل‌ها را در اختیار دارید!</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* exam scores */}
        <section>
          <div className="tg-group-title flex items-center gap-2 max-lg:mx-3">
            <Gauge size={16} className="text-sky" />
            <span>نتایج آزمون‌ها</span>
          </div>
          {state.examAttempts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              هنوز آزمونی نداده‌اید. بعد از تکمیل درس‌های هر فصل، در آزمون پایان فصل شرکت کنید.
            </p>
          ) : (
            <div className="tg-group max-lg:-mx-1">
              {state.examAttempts.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  to={`/chapters/${a.chapterId}/exam/result/${a.id}`}
                  className="tg-row"
                >
                  <span className="tg-row-body">
                    <span className="tg-row-title">{a.chapterTitle}</span>
                    <span className="tg-row-sub">
                      {toFa(a.correct)} صحیح • {toFa(a.wrong)} غلط • {formatDate(a.date)}
                    </span>
                  </span>
                  <span
                    className={cls(
                      "chip shrink-0",
                      a.passed
                        ? "border border-teal/25 bg-teal/10 text-teal"
                        : "border border-danger/25 bg-danger/10 text-danger"
                    )}
                  >
                    {toFa(a.score)} از ۱۰۰
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* badges */}
        <section>
          <div className="tg-group-title flex items-center gap-2 max-lg:mx-3">
            <Award size={16} className="text-warn" />
            <span>نشان‌ها و دستاوردها</span>
          </div>
          <div className="tg-group max-lg:-mx-1">
            {BADGES.slice(0, 8).map((b) => {
              const earned = earnedBadges.includes(b.id);
              return (
                <div key={b.id} title={b.description} className="tg-row">
                  <span
                    className={cls(
                      "tg-row-icon !h-10 !w-10 text-xl",
                      earned ? "bg-warn/10" : "opacity-50"
                    )}
                  >
                    {earned ? <BadgeGlyph id={b.id} size={18} /> : <Lock size={18} />}
                  </span>
                  <span className="tg-row-body">
                    <span className={cls("tg-row-title", !earned && "text-muted")}>{b.title}</span>
                    <span className="tg-row-sub">{b.description}</span>
                  </span>
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
