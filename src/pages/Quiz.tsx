import { Link } from "react-router-dom";
import {
  Check,
  Flame,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  Trophy,
  CheckCircle2,
  Medal,
  Star,
  Sparkles,
  Swords,
} from "lucide-react";
import { LIVE_MATCH } from "../lib/data";
import { quizCategoryIcon } from "../lib/entityIcons";
import { useApp } from "../lib/store";
import { cls, toFa } from "../lib/utils";
import { Avatar } from "../components/ui";
import { isLaravelConfigured, laravelLeaderboard } from "../lib/laravel";
import { useEffect, useState } from "react";

/** Difficulty only tints the word — no filled badge, like a status colour. */
const DIFF_TEXT: Record<string, string> = {
  آسان: "text-teal",
  متوسط: "text-warn",
  سخت: "text-danger",
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
    <div className="mx-auto w-full max-w-[720px] px-4 py-4">
      <header className="pb-1">
        <h1 className="text-[22px] font-semibold leading-8 max-lg:hidden">کوییز هوش مصنوعی</h1>
        <p className="mt-1 text-[13px] leading-6 text-muted">
          هر روز یک کوییز کوتاه، امتیاز بگیر، زنجیره بساز و نشان بگیر.
        </p>
      </header>

      {/* streak */}
      <div className="tg-group mt-3 lg:rounded-xl lg:shadow-card">
        <div className="tg-row">
          <span className="tg-row-icon text-neon">
            <Flame size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">زنجیرهی روزانه</span>
            <span className="tg-row-sub">
              {streak > 0
                ? "با پاسخ روزانه زنجیره را حفظ کن — ۷ روز = نشان آتش‌پاره"
                : "امروز اولین روز زنجیره‌ات را شروع کن"}
            </span>
          </span>
          <span className="tg-row-value">{toFa(streak)} روز</span>
        </div>
        {!user && (
          <Link to="/auth" className="tg-row">
            <span className="tg-row-icon">
              <Star size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">ورود برای شروع زنجیره</span>
              <span className="tg-row-sub">ورود فقط با شماره موبایل — چند ثانیه</span>
            </span>
            <ChevronLeft size={18} className="shrink-0 text-locked" />
          </Link>
        )}
      </div>

      {/* modes */}
      <p className="tg-group-title">شروع کوییز</p>
      <div className="tg-group max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
        <Link to={`/quiz/${daily.id}`} className="tg-row">
          <span className="tg-row-icon text-teal">
            <CalendarDays size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">کوییز روزانه</span>
            <span className="tg-row-sub">
              {toFa(daily.questions.length)} سؤال · {toFa(daily.durationSeconds)} ثانیه · تا{" "}
              {toFa(daily.pointsPerQuestion * daily.questions.length)} امتیاز
            </span>
          </span>
          {dailyDone ? (
            <span className="flex shrink-0 items-center gap-1 text-[12px] text-teal">
              <CheckCircle2 size={15} /> انجام شد
            </span>
          ) : (
            <span className="shrink-0 text-[12px] font-medium text-neon">شروع</span>
          )}
        </Link>

        <Link to="/quiz/live" className="tg-row">
          <span className="tg-row-icon text-danger">
            <Swords size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">مسابقهی زنده</span>
            <span className="tg-row-sub">
              {toFa(LIVE_MATCH.secondsPerQuestion)} ثانیه برای هر سؤال · {toFa(matchStats.wins)} برد
              از {toFa(matchStats.total)} مسابقه
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-medium text-neon">رقابت</span>
        </Link>

        <Link to={`/quiz/${weekly.id}`} className="tg-row">
          <span className="tg-row-icon text-sky">
            <CalendarRange size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">کوییز هفتگی</span>
            <span className="tg-row-sub">
              {toFa(weekly.questions.length)} سؤال · {toFa(weekly.durationSeconds)} ثانیه · تا{" "}
              {toFa(weekly.pointsPerQuestion * weekly.questions.length)} امتیاز
            </span>
          </span>
          <span
            className={cls("shrink-0 text-[12px]", DIFF_TEXT[weekly.difficulty] ?? "text-muted")}
          >
            {weekly.difficulty}
          </span>
        </Link>
      </div>

      {/* categories */}
      <p className="tg-group-title">دسته‌بندی موضوعی</p>
      <div className="tg-group max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
        {categories.map((qz) => (
          <Link key={qz.id} to={`/quiz/${qz.id}`} className="tg-row">
            <span className="tg-row-icon">
              <CatIcon id={qz.id} category={qz.category} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">{qz.category}</span>
              <span className="tg-row-sub">
                {toFa(qz.questions.length)} سؤال · {toFa(qz.durationSeconds)} ثانیه
              </span>
            </span>
            <span className={cls("shrink-0 text-[12px]", DIFF_TEXT[qz.difficulty] ?? "text-muted")}>
              {qz.difficulty}
            </span>
          </Link>
        ))}
      </div>

      {/* leaderboard */}
      <p className="tg-group-title">
        <span className="inline-flex items-center gap-1.5">
          <Trophy size={13} /> جدول رتبه‌بندی هفته
        </span>
      </p>
      <div className="tg-group max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
        {leaderboard.map((p, i) => (
          <div key={p.name} className="tg-row">
            <span className="w-5 shrink-0 text-center text-[13px] tabular-nums text-muted">
              {toFa(i + 1)}
            </span>
            <Avatar name={p.name} size="sm" />
            <span className="tg-row-body">
              <span className="tg-row-title">{p.name}</span>
            </span>
            {p.medal === "gold" && <Medal size={16} className="shrink-0 text-warn" />}
            {p.medal === "silver" && <Medal size={16} className="shrink-0 text-muted" />}
            {p.medal === "bronze" && <Medal size={16} className="shrink-0 text-[#B7791F]" />}
            <span className="tg-row-value">{toFa(p.points)}</span>
          </div>
        ))}
        {leaderboard.length === 0 && (
          <div className="tg-row text-[13px] text-muted">
            هنوز رتبه‌بندی برای این هفته ثبت نشده.
          </div>
        )}
      </div>
      <p className="px-4 pt-2 text-[11px] text-locked">
        {isLaravelConfigured() ? "رتبه‌بندی کاربران واقعی" : "رتبه‌بندی هفتگی"}
      </p>

      {/* your stats */}
      <p className="tg-group-title">امتیاز و نشان‌های شما</p>
      <div className="tg-group max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
        <div className="tg-row">
          <span className="tg-row-body">
            <span className="tg-row-title">امتیاز کل</span>
          </span>
          <span className="tg-row-value">{toFa(user?.points ?? 0)}</span>
        </div>
        <div className="tg-row">
          <span className="tg-row-body">
            <span className="tg-row-title">کوییزهای انجام‌شده</span>
          </span>
          <span className="tg-row-value">{toFa(state.quizAttempts.length)}</span>
        </div>
        <div className="tg-row">
          <span className="tg-row-body">
            <span className="tg-row-title">مجموع پاسخ‌های درست</span>
          </span>
          <span className="tg-row-value">
            {toFa(state.quizAttempts.reduce((a, x) => a + x.score, 0))}
          </span>
        </div>
      </div>

      {/* week streak */}
      <p className="tg-group-title">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={13} /> زنجیرهی این هفته
        </span>
      </p>
      <div className="tg-group max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
        <div className="tg-row justify-between">
          {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((d, i) => (
            <span key={d} className="flex flex-col items-center gap-1.5">
              <span
                className={cls(
                  "grid h-9 w-9 place-items-center rounded-full text-[13px]",
                  i < streak ? "bg-neon/10 text-neon" : "bg-surface2 text-locked"
                )}
              >
                {i < streak ? <Check size={13} strokeWidth={3} /> : "·"}
              </span>
              <span className="text-[10px] text-muted">{d}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 px-1 text-[12px] leading-6 text-muted">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-sky" />
        بعد از هر سؤال، پاسخ درست با توضیح کوتاه نمایش داده می‌شود و می‌توانی نتیجه‌ات را به‌اشتراک
        بگذاری.
      </p>
    </div>
  );
}

/** Per-quiz lucide icon (was an emoji map). */
function CatIcon({ id, category }: { id: string; category: string }) {
  const QuizIcons: Record<string, typeof Sparkles> = {
    "quiz-daily": Flame,
    "quiz-weekly": Trophy,
  };
  const I = QuizIcons[id] ?? quizCategoryIcon(category);
  return <I size={19} />;
}
