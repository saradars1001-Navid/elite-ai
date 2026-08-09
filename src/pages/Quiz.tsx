import { Link } from "react-router-dom";
import {
  Flame,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  Clock,
  Trophy,
  CheckCircle2,
  Medal,
  Star,
  Sparkles,
  PlayCircle,
  Swords,
} from "lucide-react";
import { LIVE_MATCH } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, toFa } from "../lib/utils";
import { Avatar } from "../components/ui";
import { isLaravelConfigured, laravelLeaderboard } from "../lib/laravel";
import { useEffect, useState } from "react";

const DIFF_STYLE = {
  آسان: "border border-teal/25 bg-teal/10 text-teal",
  متوسط: "border border-warn/25 bg-warn/10 text-warn",
  سخت: "border border-danger/25 bg-danger/10 text-danger",
};

// demo leaderboard (clearly marked as sample)
const LEADERBOARD = [
  { name: "سارا محمدی", points: 1280, medal: "gold" },
  { name: "علی موسوی", points: 1150, medal: "silver" },
  { name: "نیلوفر حسینی", points: 980, medal: "bronze" },
  { name: "رضا کاظمی", points: 860 },
  { name: "مینا صادقی", points: 790 },
  { name: "پارسا نادری", points: 720 },
];

export default function Quiz() {
  const { user, isDailyQuizDone, state, matchStats, quizzes } = useApp();
  const [leaderboard, setLeaderboard] = useState(LEADERBOARD);
  useEffect(() => {
    if (!isLaravelConfigured()) return;
    void laravelLeaderboard()
      .then((rows) =>
        setLeaderboard(
          rows.map((row) => ({
            name: String(row.name || "کاربر"),
            points: Number(row.xp || row.points || 0),
            medal: undefined,
          }))
        )
      )
      .catch(() => setLeaderboard([]));
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  const dailyDone = isDailyQuizDone(today);
  const daily = quizzes.find((q) => q.id === "quiz-daily")!;
  const weekly = quizzes.find((q) => q.id === "quiz-weekly")!;
  const categories = quizzes.filter((q) => q.kind === "category");
  const streak = user?.streakDays ?? 0;

  return (
    <div className="container-x py-10 sm:py-14">
      <div className="mb-8">
        <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">
          <GameIcon /> بازی و یادگیری
        </span>
        <h1 className="text-2xl font-black sm:text-3xl">کوییز هوش مصنوعی</h1>
        <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
          هر روز یک کوییز کوتاه، امتیاز بگیرید، زنجیره بسازید و نشان‌های افتخار دریافت کنید.
        </p>
      </div>

      {/* streak banner */}
      <div className="card mb-8 flex flex-wrap items-center justify-between gap-4 overflow-hidden border border-[#F97316]/25 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F97316]/15 text-[#F97316]">
            <Flame size={24} />
          </span>
          <div>
            <p className="font-bold">
              زنجیره شما: <span className="text-[#F97316]">{toFa(streak)} روز پیاپی</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              با پاسخ روزانه به کوییز، زنجیره را حفظ کنید. ۷ روز = نشان «آتش‌پاره» 🔥
            </p>
          </div>
        </div>
        {!user && (
          <Link to="/auth" className="btn-secondary btn-sm">
            ورود برای شروع زنجیره
          </Link>
        )}
      </div>

      {/* daily & weekly & live */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* daily */}
        <Link
          to={`/quiz/${daily.id}`}
          className={cls(
            "card group relative overflow-hidden p-6 transition-all",
            dailyDone ? "opacity-80" : "hover:border-neon/50 hover:shadow-glow-sm"
          )}
        >
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-teal/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal/15 text-teal">
              <CalendarDays size={22} />
            </span>
            <span className="chip shrink-0 border border-teal/25 bg-teal/10 text-teal">
              {dailyDone ? (
                <>
                  <CheckCircle2 size={13} /> امروز انجام شد
                </>
              ) : (
                "آماده امروز"
              )}
            </span>
          </div>
          <h3 className="relative mt-4 text-lg font-black">کوییز روزانه</h3>
          <p className="relative mt-1 text-sm leading-7 text-muted">
            {toFa(daily.questions.length)} سؤال در {toFa(daily.durationSeconds)} ثانیه — تا{" "}
            {toFa(daily.pointsPerQuestion * daily.questions.length)} امتیاز
          </p>
          <div className="relative mt-4 flex items-center gap-3">
            <span className={cls("chip", DIFF_STYLE[daily.difficulty])}>{daily.difficulty}</span>
            <span className="chip border border-line bg-surface2 text-muted">
              <Clock size={12} /> {toFa(daily.durationSeconds)} ثانیه
            </span>
            <span className="mr-auto flex items-center gap-1 text-sm font-bold text-neon group-hover:underline">
              {dailyDone ? "بازبینی" : "شروع"} <ChevronLeft size={16} />
            </span>
          </div>
        </Link>

        {/* live match */}
        <Link
          to="/quiz/live"
          className="card group relative overflow-hidden p-6 transition-all hover:border-[#F0445B]/50 hover:shadow-glow-sm"
        >
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[#F0445B]/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#F0445B]/15 text-[#FF6B81]">
              <Swords size={22} />
            </span>
            <span className="chip shrink-0 border border-[#F0445B]/25 bg-[#F0445B]/10 text-[#FF6B81]">
              هم‌اکنون فعال
            </span>
          </div>
          <h3 className="relative mt-4 text-lg font-black">مسابقه زنده</h3>
          <p className="relative mt-1 text-sm leading-7 text-muted">
            ۶ سؤال سرعتی در برابر رقبا با جدول زنده — برد و باخت در لحظه
          </p>
          <div className="relative mt-4 flex items-center gap-3">
            <span className="chip border border-line bg-surface2 text-muted">
              {toFa(LIVE_MATCH.secondsPerQuestion)} ثانیه برای هر سؤال
            </span>
            <span className="chip border border-teal/25 bg-teal/10 text-teal">
              {toFa(matchStats.wins)} برد از {toFa(matchStats.total)} مسابقه
            </span>
            <span className="mr-auto flex items-center gap-1 text-sm font-bold text-[#FF6B81] group-hover:underline">
              رقابت <ChevronLeft size={16} />
            </span>
          </div>
        </Link>

        {/* weekly */}
        <Link
          to={`/quiz/${weekly.id}`}
          className="card group relative overflow-hidden p-6 transition-all hover:border-[#8B5CF6]/50 hover:shadow-glow-sm"
        >
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[#8B5CF6]/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#8B5CF6]/15 text-[#A78BFA]">
              <CalendarRange size={22} />
            </span>
            <span className="chip shrink-0 border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#A78BFA]">
              {toFa(weekly.pointsPerQuestion * weekly.questions.length)} امتیاز
            </span>
          </div>
          <h3 className="relative mt-4 text-lg font-black">کوییز هفتگی</h3>
          <p className="relative mt-1 text-sm leading-7 text-muted">
            {toFa(weekly.questions.length)} سؤال ترکیبی سخت در {toFa(weekly.durationSeconds)} ثانیه
            — رقابت برای صدر جدول
          </p>
          <div className="relative mt-4 flex items-center gap-3">
            <span className={cls("chip", DIFF_STYLE[weekly.difficulty])}>{weekly.difficulty}</span>
            <span className="chip border border-line bg-surface2 text-muted">
              <Clock size={12} /> {toFa(weekly.durationSeconds)} ثانیه
            </span>
            <span className="mr-auto flex items-center gap-1 text-sm font-bold text-[#A78BFA] group-hover:underline">
              شروع <ChevronLeft size={16} />
            </span>
          </div>
        </Link>
      </div>

      {/* categories */}
      <div className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title">دسته‌بندی موضوعی</h2>
            <p className="mt-1 text-sm text-muted">کوییزهای تخصصی برای هر حوزه</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((qz) => (
            <Link
              key={qz.id}
              to={`/quiz/${qz.id}`}
              className="card group p-5 transition-all hover:-translate-y-0.5 hover:border-neon/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-navy text-lg">
                  {CAT_ICONS[qz.category] ?? "🧩"}
                </span>
                <span className={cls("chip", DIFF_STYLE[qz.difficulty])}>{qz.difficulty}</span>
              </div>
              <h3 className="font-bold transition-colors group-hover:text-sky">{qz.category}</h3>
              <p className="mt-1 text-xs text-muted">
                {toFa(qz.questions.length)} سؤال • {toFa(qz.durationSeconds)} ثانیه
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-neon">
                <PlayCircle size={14} /> شروع کوییز
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* leaderboard */}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Trophy size={18} className="text-warn" /> جدول رتبه‌بندی هفته
            </h2>
            <span className="text-[11px] text-locked">
              {isLaravelConfigured() ? "رتبه‌بندی کاربران واقعی" : "نمونه نسخه نمایشی"}
            </span>
          </div>
          <div className="space-y-2">
            {leaderboard.map((p, i) => (
              <div
                key={p.name}
                className={cls(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5",
                  i === 0 ? "border border-warn/25 bg-warn/5" : "bg-surface2/40"
                )}
              >
                <span className="w-6 text-center text-sm font-black text-muted">{toFa(i + 1)}</span>
                <Avatar name={p.name} size="sm" />
                <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                {p.medal === "gold" && <Medal size={16} className="text-warn" />}
                {p.medal === "silver" && <Medal size={16} className="text-muted" />}
                {p.medal === "bronze" && <Medal size={16} className="text-[#CD7F32]" />}
                <span className="text-xs font-bold text-sky">{toFa(p.points)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <Star size={17} className="text-warn" /> امتیاز و نشان‌ها
            </h2>
            <div className="space-y-2.5 text-sm text-muted">
              <p className="flex items-center justify-between">
                <span>امتیاز کل شما</span>
                <b className="text-text">{toFa(user?.points ?? 0)}</b>
              </p>
              <p className="flex items-center justify-between">
                <span>کوییزهای انجام‌شده</span>
                <b className="text-text">{toFa(state.quizAttempts.length)}</b>
              </p>
              <p className="flex items-center justify-between">
                <span>امتیاز کوییز (مجموع پاسخ‌های درست)</span>
                <b className="text-text">
                  {toFa(state.quizAttempts.reduce((a, x) => a + x.score, 0))}
                </b>
              </p>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg border border-sky/20 bg-sky/5 px-3.5 py-3 text-xs leading-6 text-muted">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-sky" />
              بعد از هر سؤال، پاسخ درست با توضیح کوتاه نمایش داده می‌شود و می‌توانید نتیجه خود را به
              اشتراک بگذارید.
            </p>
          </div>
          <div className="card p-6">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <CalendarDays size={17} className="text-teal" /> زنجیره پاسخ روزانه
            </h2>
            <div className="flex justify-between">
              {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((d, i) => (
                <span key={d} className="flex flex-col items-center gap-1.5">
                  <span
                    className={cls(
                      "grid h-9 w-9 place-items-center rounded-lg text-sm",
                      i < (user?.streakDays ?? 0)
                        ? "bg-[#F97316]/15 text-[#F97316]"
                        : "bg-surface2 text-locked"
                    )}
                  >
                    {i < (user?.streakDays ?? 0) ? "🔥" : "·"}
                  </span>
                  <span className="text-[10px] text-muted">{d}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameIcon() {
  return <span>🎮</span>;
}

const CAT_ICONS: Record<string, string> = {
  "ابزارهای هوش مصنوعی": "🛠️",
  پرامپت‌نویسی: "⌨️",
  "تولید تصویر": "🎨",
  "تولید ویدئو": "🎬",
  "هوش مصنوعی مولد": "🧠",
  بهره‌وری: "⚡",
  "کدنویسی با AI": "💻",
  "اخلاق و امنیت هوش مصنوعی": "🛡️",
};
