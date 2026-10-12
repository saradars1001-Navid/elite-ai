import { ChGlyph, LevelGlyph } from "../lib/entityIcons";
import { Link } from "react-router-dom";
import {
  PlayCircle,
  FileText,
  Dumbbell,
  ClipboardCheck,
  BadgePercent,
  Users,
  Wrench,
  Video,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Lock,
  GraduationCap,
  BookOpen,
  Trophy,
  Star,
  ChevronLeft,
  Rocket,
  Flame,
  Gamepad2,
  MessageCircle,
  Clock,
  PlaySquare,
  TrendingUp,
} from "lucide-react";
import { TESTIMONIALS, levelStyles } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, hours, price, priceShort, toFa, timeAgo } from "../lib/utils";
import { Progress, Stars, Avatar } from "../components/ui";

const FEATURES = [
  {
    icon: Video,
    title: "آموزش ویدئویی",
    text: "درس‌های ویدئویی کوتاه و متمرکز با کیفیت بالا و زیرنویس فارسی.",
  },
  {
    icon: FileText,
    title: "درسنامه متنی",
    text: "متن کامل هر درس برای مرور و یادداشت‌برداری، همیشه در دسترس.",
  },
  {
    icon: Dumbbell,
    title: "تمرین عملی",
    text: "تمرین‌های مفهومی و عملی واقعی با ابزارهای هوش مصنوعی.",
  },
  {
    icon: ClipboardCheck,
    title: "آزمون پایان فصل",
    text: "سنجش دقیق یادگیری با تحلیل موضوعی عملکرد شما.",
  },
  {
    icon: BadgePercent,
    title: "تخفیف بر اساس عملکرد",
    text: "نمره عالی در آزمون یعنی تخفیف واقعی برای فصل بعد.",
  },
  {
    icon: Users,
    title: "کامیونیتی تخصصی",
    text: "پرسش، پاسخ و اشتراک تجربه با سایر یادگیرنده‌ها.",
  },
  {
    icon: Wrench,
    title: "بانک ابزارهای AI",
    text: "بیش از ۳۰ ابزار بررسی‌شده با فیلتر و دسته‌بندی دقیق.",
  },
  {
    icon: Sparkles,
    title: "کوییز روزانه",
    text: "بازی، امتیاز و زنجیره پاسخ برای یادگیری روزانه.",
  },
];

export default function Home() {
  const { user, chapters, aiTools, managedUsers, quizzes } = useApp();
  const lessonsCount = chapters.reduce((a, c) => a + c.lessons.length, 0);
  const exercisesCount = chapters.reduce((a, c) => a + c.exercises.length, 0);
  const studentsCount = Math.max(managedUsers.length * 4, 240);

  return (
    <div>
      {/* ───────────── Mobile: app-like home ───────────── */}
      <div className="lg:hidden">
        <MobileHome />
      </div>

      {/* ───────────── Desktop: marketing home ───────────── */}
      <div className="hidden lg:block">
        {/* ─────────────── Hero ─────────────── */}
        <section className="relative overflow-hidden border-b border-line/50">
          <div className="bg-grid absolute inset-0" />
          <div className="absolute -top-32 left-1/2 h-96 w-[700px] -translate-x-1/2 rounded-full bg-neon/10 blur-[120px]" />
          <div className="container-x relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2">
            <div className="animate-slide-up">
              <span className="chip mb-5 border border-neon/30 bg-neon/10 text-sky">
                <Sparkles size={13} /> مسیر تعاملی یادگیری هوش مصنوعی
              </span>
              <h1 className="text-3xl font-black leading-[1.35] sm:text-4xl lg:text-5xl lg:leading-[1.3]">
                هوش مصنوعی را یاد بگیر، <span className="text-gradient">استفاده کن</span> و به کار
                بگیر
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-muted sm:text-lg sm:leading-9">
                یک مسیر مرحله‌به‌مرحله برای یادگیری ابزارها، پرامپت‌نویسی و کاربردهای واقعی هوش
                مصنوعی — از فصل‌های پایه تا ساخت پروژه واقعی.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={user ? "/dashboard" : "/auth"} className="btn-primary btn-lg">
                  <Rocket size={18} /> شروع یادگیری
                </Link>
                <Link to="/chapters" className="btn-secondary btn-lg">
                  مشاهده فصل‌ها
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                {[
                  {
                    icon: GraduationCap,
                    label: "دانشجوی فعال",
                    value: toFa(studentsCount.toLocaleString()),
                  },
                  { icon: BookOpen, label: "درس آموزشی", value: toFa(lessonsCount) },
                  { icon: Trophy, label: "کوییز", value: toFa(quizzes.length) },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface text-neon">
                      <s.icon size={18} />
                    </span>
                    <div>
                      <p className="text-lg font-black leading-5">{s.value}</p>
                      <p className="text-xs text-muted">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* hero visual */}
            <div className="relative hidden lg:block">
              <div className="relative mx-auto w-full max-w-md">
                <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-neon/20 to-teal/10 blur-2xl" />
                <div className="card relative overflow-hidden p-0">
                  <div className="bg-grid h-40 border-b border-line/60 bg-navy" />
                  <div className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <span className="chip border border-teal/25 bg-teal/10 text-teal">
                        <span className="h-2 w-2 animate-pulse-soft rounded-full bg-teal" /> فصل ۱ —
                        رایگان
                      </span>
                      <span className="text-xs text-muted">۲۴ دقیقه</span>
                    </div>
                    <h3 className="font-bold">شناخت هوش مصنوعی و ابزارهای مولد</h3>
                    <div className="space-y-2">
                      {[
                        "هوش مصنوعی چیست؟",
                        "مدل‌های مولد چگونه کار می‌کنند؟",
                        "ابزارهای پرکاربرد",
                      ].map((l, i) => (
                        <div
                          key={l}
                          className="flex items-center gap-2.5 rounded-lg border border-line/50 bg-surface2 px-3 py-2.5 text-sm"
                        >
                          {i < 2 ? (
                            <CheckCircle2 size={15} className="text-teal" />
                          ) : (
                            <PlayCircle size={15} className="text-sky" />
                          )}
                          <span
                            className={
                              i < 2 ? "text-muted line-through decoration-line" : "text-text"
                            }
                          >
                            {l}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="text-muted">پیشرفت شما</span>
                        <span className="font-bold text-sky">۶۷٪</span>
                      </div>
                      <Progress value={67} />
                    </div>
                  </div>
                </div>

                {/* floating chips */}
                <div className="card absolute -right-8 top-8 flex items-center gap-2 px-3.5 py-2.5 animate-fade-in">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-teal/15 text-teal">
                    <BadgePercent size={15} />
                  </span>
                  <div className="text-xs">
                    <p className="font-bold">تخفیف عملکردی</p>
                    <p className="text-muted">تا ۳۰٪ فصل بعد</p>
                  </div>
                </div>
                <div className="card absolute -left-6 bottom-24 flex items-center gap-2 px-3.5 py-2.5 animate-fade-in">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-warn/15 text-warn">
                    <Trophy size={15} />
                  </span>
                  <div className="text-xs">
                    <p className="font-bold">زنجیره کوییز</p>
                    <p className="text-muted">۷ روز پیاپی</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* continuity strip into next section */}
          <div className="relative h-10 bg-gradient-to-b from-transparent to-page" aria-hidden />
        </section>

        {/* ─────────────── Learning path ─────────────── */}
        <section className="container-x py-14 sm:py-20">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">
                مسیر آموزشی
              </span>
              <h2 className="section-title">مسیر مرحله‌به‌مرحله یادگیری</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
                شش فصل طراحی‌شده که از مفاهیم پایه شروع می‌شود و به ساخت پروژه واقعی می‌رسد. هر فصل
                را جداگانه بخرید و با هر نمره‌ای که بگیرید، ادامه دهید.
              </p>
            </div>
            <Link to="/chapters" className="btn-secondary btn-md hidden shrink-0 sm:inline-flex">
              همه فصل‌ها <ArrowLeft size={15} />
            </Link>
          </div>

          <div className="relative">
            {/* path line */}
            <div className="absolute right-[27px] top-0 hidden h-full w-0.5 bg-gradient-to-b from-neon via-line to-line sm:block" />
            <div className="space-y-5">
              {chapters.map((ch, i) => (
                <Link
                  key={ch.id}
                  to={`/chapters/${ch.id}`}
                  className="group relative flex gap-4 rounded-lg sm:gap-6"
                >
                  {/* node */}
                  <div className="relative z-10 hidden w-14 shrink-0 justify-center sm:flex">
                    <span
                      className={cls(
                        "grid h-14 w-14 place-items-center rounded-xl border text-xl transition-transform group-hover:scale-105",
                        i === 0
                          ? "border-teal/40 bg-teal/15 shadow-glow-sm"
                          : "border-line bg-surface"
                      )}
                    >
                      <ChGlyph id={ch.id} size={22} />
                    </span>
                  </div>
                  <div className="card flex-1 p-5 transition-all group-hover:border-neon/40 group-hover:shadow-glow-sm sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-sky">فصل {toFa(ch.index)}</span>
                          <span className={cls("chip", levelStyles[ch.level])}>{ch.level}</span>
                          {ch.free && (
                            <span className="chip border border-teal/25 bg-teal/10 text-teal">
                              رایگان
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold transition-colors group-hover:text-sky">
                          {ch.title}
                        </h3>
                        <p className="mt-1.5 max-w-2xl text-sm leading-7 text-muted">
                          {ch.subtitle}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                          <span>{toFa(ch.lessons.length)} درس</span>
                          <span>{toFa(ch.exercises.length)} تمرین</span>
                          <span>{hours(ch.duration)}</span>
                          <span className="flex items-center gap-1">
                            <Star size={12} className="fill-warn text-warn" /> {toFa(ch.rating)}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-lg font-black text-text">
                          {ch.free ? "رایگان" : price(ch.price)}
                        </span>
                        {!ch.free && (
                          <span className="flex items-center gap-1.5 text-xs text-muted">
                            <Lock size={12} /> برای خرید
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Progress value={ch.completionRate} className="flex-1" />
                      <span className="shrink-0 text-xs text-muted">
                        {toFa(ch.completionRate)}٪ تکمیل کاربران
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Link to="/chapters" className="btn-secondary btn-md">
              همه فصل‌ها <ArrowLeft size={15} />
            </Link>
          </div>
        </section>

        {/* ─────────────── Latest chapters ─────────────── */}
        <section className="border-y border-line/50 bg-surface/40 py-14 sm:py-20">
          <div className="container-x">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">
                  جدیدترین فصل‌ها
                </span>
                <h2 className="section-title">از همین امروز شروع کنید</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.slice(0, 6).map((ch) => (
                <Link
                  key={ch.id}
                  to={`/chapters/${ch.id}`}
                  className="card group overflow-hidden transition-all hover:-translate-y-0.5 hover:border-neon/40 hover:shadow-glow-sm"
                >
                  <div
                    className={cls(
                      "bg-grid relative h-28 border-b border-line/50 bg-gradient-to-br",
                      ch.gradient
                    )}
                  >
                    <span className="absolute bottom-3 right-4 text-3xl">
                      <ChGlyph id={ch.id} size={26} />
                    </span>
                    <span className="absolute left-3 top-3 chip bg-black/30 text-white backdrop-blur">
                      سطح {ch.level}
                    </span>
                  </div>
                  <div className="space-y-3 p-5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-sky">فصل {toFa(ch.index)}</span>
                      {ch.free && (
                        <span className="chip border border-teal/25 bg-teal/10 text-teal">
                          رایگان
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold leading-6 transition-colors group-hover:text-sky">
                      {ch.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span>{toFa(ch.lessons.length)} درس</span>
                      <span>{hours(ch.duration)}</span>
                      <span className="flex items-center gap-1">
                        <Star size={12} className="fill-warn text-warn" /> {toFa(ch.rating)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {toFa(ch.students.toLocaleString())}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-black">{ch.free ? "رایگان" : price(ch.price)}</span>
                      <span className="flex items-center gap-1 text-sm font-medium text-neon">
                        مشاهده فصل{" "}
                        <ChevronLeft
                          size={16}
                          className="transition-transform group-hover:-translate-x-1"
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────── Features ─────────────── */}
        <section className="container-x py-14 sm:py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">
              چرا آکادمی ایلیت؟
            </span>
            <h2 className="section-title">هر چیزی که برای یادگیری عملی نیاز دارید</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              نه فقط ویدئو و متن؛ بلکه تمرین، آزمون، تخفیف عملکردی و یک کامیونیتی واقعی برای همراهی
              در تمام مسیر.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card group p-5 transition-all hover:-translate-y-0.5 hover:border-neon/40"
              >
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-lg border border-neon/20 bg-neon/10 text-neon transition-all group-hover:shadow-glow-sm">
                  <f.icon size={20} />
                </span>
                <h3 className="mb-1.5 font-bold">{f.title}</h3>
                <p className="text-sm leading-7 text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─────────────── Stats ─────────────── */}
        <section className="border-y border-line/50 bg-navy/40 py-14">
          <div className="container-x grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {[
              { v: toFa(studentsCount.toLocaleString()), l: "دانشجوی فعال" },
              { v: toFa(lessonsCount), l: "درس آموزشی" },
              { v: toFa(exercisesCount), l: "تمرین تعاملی" },
              { v: toFa(aiTools.length), l: "ابزار بررسی‌شده" },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-3xl font-black text-gradient">{s.v}</p>
                <p className="mt-1 text-sm text-muted">{s.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─────────────── Testimonials ─────────────── */}
        <section className="container-x py-14 sm:py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">
              نظرات کاربران
            </span>
            <h2 className="section-title">تجربه یادگیرنده‌ها</h2>
            <p className="mt-3 text-sm text-muted">آنچه یادگیرندگان از این مسیر می‌گویند</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.id} className="card flex flex-col gap-4 p-6">
                <Stars rating={t.rating} size={16} />
                <blockquote className="flex-1 text-sm leading-8 text-muted">«{t.text}»</blockquote>
                <figcaption className="flex items-center gap-3 border-t border-line/50 pt-4">
                  <Avatar name={t.name} size="md" />
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-muted">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ─────────────── CTA ─────────────── */}
        <section className="container-x pb-16">
          <div className="card relative overflow-hidden p-8 text-center sm:p-14">
            <div className="bg-grid absolute inset-0 opacity-60" />
            <div className="absolute -top-20 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-neon/15 blur-[90px]" />
            <div className="relative">
              <h2 className="text-2xl font-black sm:text-3xl">آماده‌اید مسیر را شروع کنید؟</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-muted sm:text-base">
                فصل اول کاملاً رایگان است. همین امروز شروع کنید و با نمره‌های خوب، تخفیف واقعی برای
                فصل‌های بعدی بگیرید.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link to={user ? "/dashboard" : "/auth"} className="btn-primary btn-lg">
                  شروع یادگیری <ArrowLeft size={18} />
                </Link>
                <Link to="/quiz" className="btn-secondary btn-lg">
                  <Trophy size={18} /> کوییز روزانه
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────── Mobile app home ─────────────────────────── */

function MobileHome() {
  const {
    user,
    state,
    chapters,
    quizzes,
    aiTools,
    communityPosts,
    level,
    xp,
    chapterProgress,
    isDailyQuizDone,
  } = useApp();

  const today = new Date().toISOString().slice(0, 10);
  const dailyDone = isDailyQuizDone(today);
  const streak = user?.streakDays ?? 0;
  const dateStr = new Intl.DateTimeFormat("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  // آخرین فصل دارای پیشرفت + آخرین درس تکمیل‌شده در همان فصل (برای «ادامه یادگیری»)
  const chaptersWithProgress = chapters
    .filter((c) => c.lessons.some((l) => state.lessonProgress[c.id]?.[l.id]))
    .sort((a, b) => b.index - a.index);
  const lastChapter = chaptersWithProgress[0];
  const lastDoneInChapter = lastChapter
    ? lastChapter.lessons
        .filter((l) => state.lessonProgress[lastChapter.id]?.[l.id])
        .sort((a, b) => b.index - a.index)[0]
    : undefined;
  const continueTarget =
    lastDoneInChapter && lastChapter
      ? { chapterId: lastChapter.id, lessonId: lastDoneInChapter.id, chapter: lastChapter }
      : null;
  const hasProgress = !!continueTarget;
  const fallbackChapter = chapters.find((c) => c.free) ?? chapters[0];
  const target = continueTarget ?? {
    chapterId: fallbackChapter?.id ?? "",
    lessonId: fallbackChapter?.lessons[0]?.id ?? "",
    chapter: fallbackChapter,
  };
  const targetChapter = target.chapter;
  const targetLesson =
    targetChapter?.lessons.find((l) => l.id === target.lessonId) ?? targetChapter?.lessons[0];

  const dailyQuiz = quizzes.find((q) => q.id === "quiz-daily") ?? quizzes[0];
  const latestPosts = [...communityPosts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  const quick = [
    { to: "/tools", icon: Wrench, label: "بانک ابزارهای هوش مصنوعی" },
    { to: "/explore", icon: PlaySquare, label: "اکسپلور ویدئو" },
    { to: "/prompt-trends", icon: TrendingUp, label: "ترند پرامپتها" },
    { to: "/community", icon: MessageCircle, label: "کامیونیتی" },
  ];

  const stories = [
    ...(hasProgress && continueTarget
      ? [
          {
            to: `/chapters/${continueTarget.chapterId}/lessons/${continueTarget.lessonId}`,
            Icon: PlayCircle,
            label: "ادامه یادگیری",
            badge: "",
          },
        ]
      : []),
    {
      to: user && dailyQuiz ? `/quiz/${dailyQuiz.id}` : "/auth",
      Icon: Flame,
      label: "کوییز امروز",
      badge: dailyDone ? "" : streak > 0 ? toFa(streak) : "",
    },
    { to: "/tools", Icon: Wrench, label: "ابزارها", badge: toFa(aiTools.length) },
    { to: "/explore", Icon: PlaySquare, label: "ویدئوها", badge: "" },
    { to: "/prompt-lab", Icon: Sparkles, label: "پرامپت‌لب", badge: "" },
    { to: "/community", Icon: MessageCircle, label: "کامیونیتی", badge: "" },
    {
      to: user ? "/profile" : "/auth",
      Icon: GraduationCap,
      label: user ? "پروفایل" : "ورود",
      badge: "",
    },
  ];

  return (
    <div className="pb-4">
      {/* greeting */}
      <section className="flex items-end justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {dateStr}
            {user && streak > 0 ? ` · ${toFa(streak)} روز پیوسته` : ""}
          </p>
          <h1 className="mt-0.5 truncate text-[22px] font-semibold leading-8 text-text">
            {user ? `سلام، ${user.name.split(" ")[0]}` : "به آکادمی ایلیت خوش آمدی"}
          </h1>
        </div>
        {user && (
          <Link to="/profile" aria-label="پروفایل" className="shrink-0">
            <Avatar name={user.name} size="md" online />
          </Link>
        )}
      </section>

      {/* stories rail — chapter/quiz/tool quick-entries with gradient rings */}
      <section className="no-scrollbar mt-5 flex gap-3.5 overflow-x-auto px-4 pb-2">
        {stories.map((st) => (
          <Link
            key={st.label}
            to={st.to}
            className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="relative inline-grid h-[62px] w-[62px] place-items-center rounded-full p-[2.5px] bg-gradient-to-tr from-neon via-teal to-warn">
              <span className="grid h-full w-full place-items-center rounded-full border-2 border-page bg-navy">
                <st.Icon size={22} strokeWidth={1.9} />
              </span>
              {st.badge && (
                <span className="absolute -bottom-0.5 -left-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-neon px-1 text-[10px] font-bold leading-none text-white">
                  {st.badge}
                </span>
              )}
            </span>
            <span className="w-full truncate text-center text-[11px] text-muted">{st.label}</span>
          </Link>
        ))}
      </section>

      {/* continue learning */}
      <p className="tg-group-title">{user && hasProgress ? "ادامه یادگیری" : "شروع یادگیری"}</p>
      <div className="tg-group">
        <Link
          to={
            user
              ? target.chapterId && target.lessonId
                ? `/chapters/${target.chapterId}/lessons/${target.lessonId}`
                : "/chapters"
              : "/auth"
          }
          className="tg-row"
        >
          <span className="tg-row-icon text-neon">
            <PlayCircle size={19} />
          </span>
          <span className="tg-row-body">
            <span className="tg-row-title">
              {user ? (targetLesson?.title ?? "شروع مسیر یادگیری") : "فصل ۱ · شناخت هوش مصنوعی"}
            </span>
            <span className="tg-row-sub">
              {targetChapter
                ? `فصل ${toFa(targetChapter.index)} · ${targetChapter.title}`
                : "از فصل اول شروع کن"}
            </span>
            {user ? (
              <span className="tg-rail">
                <span style={{ width: `${chapterProgress(target.chapterId)}%` }} />
              </span>
            ) : null}
          </span>
          <span className="tg-row-value flex items-center gap-1">
            <Clock size={12} />
            {targetLesson ? hours(targetLesson.duration) : hours(targetChapter?.duration ?? 0)}
          </span>
        </Link>
      </div>

      {/* today: daily quiz + level */}
      <p className="tg-group-title">امروز</p>
      <div className="tg-group">
        {dailyQuiz && (
          <Link to={user ? `/quiz/${dailyQuiz.id}` : "/auth"} className="tg-row">
            <span className="tg-row-icon text-neon">
              <Flame size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">کوییز امروز</span>
              <span className="tg-row-sub">
                {dailyDone ? "انجام شد — فردا دوباره سر بزن" : "امتیاز و زنجیرهی روزانه"}
              </span>
            </span>
            {dailyDone ? (
              <span className="tg-badge-quiet">انجام شد</span>
            ) : streak > 0 ? (
              <span className="tg-badge">{toFa(streak)}</span>
            ) : (
              <ChevronLeft size={18} className="shrink-0 text-locked" />
            )}
          </Link>
        )}
        {user && (
          <Link to="/profile" className="tg-row">
            <span className="tg-row-icon">
              <Star size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">
                <LevelGlyph level={level.level} size={14} /> سطح {toFa(level.level)} · {level.title}
              </span>
              <span className="tg-row-sub">{toFa(xp)} امتیاز تجربه</span>
              <span className="tg-rail">
                <span style={{ width: `${level.progress}%` }} />
              </span>
            </span>
            <span className="tg-row-value">{toFa(Math.round(level.progress))}٪</span>
          </Link>
        )}
        {!user && (
          <Link to="/auth" className="tg-row">
            <span className="tg-row-icon text-neon">
              <Rocket size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">ساخت حساب</span>
              <span className="tg-row-sub">پیشرفت، امتیاز و تخفیف با ورود ذخیره میشود</span>
            </span>
            <ChevronLeft size={18} className="shrink-0 text-locked" />
          </Link>
        )}
      </div>

      {/* shortcuts */}
      <p className="tg-group-title">میانبرها</p>
      <div className="tg-group">
        {quick.map((q) => (
          <Link key={q.to} to={q.to} className="tg-row">
            <span className="tg-row-icon">
              <q.icon size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">{q.label}</span>
            </span>
            <ChevronLeft size={18} className="shrink-0 text-locked" />
          </Link>
        ))}
      </div>

      {/* chapters */}
      {/* chapters — visual feed cards (Instagram post rhythm) */}
      <HomeSection title="مسیر یادگیری" to="/chapters" linkLabel="همه فصل‌ها">
        <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-3 pb-1">
          {chapters.slice(0, 6).map((ch) => (
            <Link
              key={ch.id}
              to={`/chapters/${ch.id}`}
              className="w-[230px] shrink-0 snap-start overflow-hidden rounded-xl border border-line/60 bg-surface text-right shadow-card transition-transform active:scale-[0.98]"
            >
              {/* media block */}
              <div className={`relative h-[110px] bg-gradient-to-br ${ch.gradient}`}>
                <span className="absolute bottom-3 right-3.5 opacity-40">
                  <ChGlyph id={ch.id} size={34} />
                </span>
                <span className="absolute left-3 top-3 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                  {ch.free ? "رایگان" : priceShort(ch.price)}
                </span>
                {user && (
                  <span className="absolute bottom-3 left-3 flex items-center gap-1 text-[10px] font-bold text-white/90">
                    <Star size={11} className="fill-white/90" /> {toFa(ch.rating)}
                  </span>
                )}
              </div>
              {/* post chrome */}
              <div className="space-y-2 p-3">
                <p className="text-[11px] font-medium text-muted">
                  فصل {toFa(ch.index)} · {hours(ch.duration)}
                </p>
                <p className="line-clamp-2 min-h-[2.4rem] text-[13.5px] font-bold leading-6">
                  {ch.title}
                </p>
                <div className="flex items-center justify-between border-t border-line/50 pt-2 text-[11px] text-muted">
                  <span className="flex items-center gap-1">
                    <FileText size={12} /> {toFa(ch.lessons.length)} درس
                  </span>
                  <span className="flex items-center gap-1 text-sky">
                    {toFa(ch.completionRate)}٪ تکمیل
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </HomeSection>

      {/* quizzes */}
      <HomeSection title="کوییزها" to="/quiz" linkLabel="همه کوییزها">
        {quizzes.slice(0, 4).map((q) => (
          <Link key={q.id} to={`/quiz/${q.id}`} className="tg-row">
            <span className="tg-row-icon">
              <Gamepad2 size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">{q.title}</span>
              <span className="tg-row-sub">
                {q.kind === "daily" ? "روزانه" : q.kind === "weekly" ? "هفتگی" : q.category} ·{" "}
                {toFa(q.questions.length)} سؤال · {q.difficulty}
              </span>
            </span>
            <span className="tg-row-value">
              {toFa(q.questions.length * q.pointsPerQuestion)} XP
            </span>
          </Link>
        ))}
      </HomeSection>

      {/* tools */}
      <HomeSection title="ابزارهای هوش مصنوعی" to="/tools" linkLabel="بانک ابزارها">
        {aiTools.slice(0, 4).map((t) => (
          <Link key={t.id} to="/tools" className="tg-row">
            <span className="tg-row-icon text-[13px] font-semibold text-sky">{t.name[0]}</span>
            <span className="tg-row-body">
              <span className="tg-row-title">{t.name}</span>
              <span className="tg-row-sub">
                {t.category} · {t.tagline}
              </span>
            </span>
            <span className="tg-row-value">{t.pricing}</span>
          </Link>
        ))}
      </HomeSection>

      {/* community preview */}
      <HomeSection title="تازه‌های کامیونیتی" to="/community" linkLabel="کامیونیتی">
        {latestPosts.length === 0 && (
          <div className="tg-row text-[13px] text-muted">هنوز پستی ثبت نشده — اولین نفر باش.</div>
        )}
        {latestPosts.map((p) => (
          <Link key={p.id} to={`/community/${p.id}`} className="tg-row">
            <Avatar name={p.author.name} size="sm" />
            <span className="tg-row-body">
              <span className="tg-row-title">{p.title}</span>
              <span className="tg-row-sub">
                {p.category} · {timeAgo(p.createdAt)}
              </span>
            </span>
            <span className="tg-row-value flex items-center gap-1">
              <MessageCircle size={12} /> {toFa(p.commentsCount)}
            </span>
          </Link>
        ))}
      </HomeSection>

      {/* guest */}
      {!user && (
        <HomeSection title="حساب کاربری" to="/auth" linkLabel="ورود">
          <Link to="/auth" className="tg-row">
            <span className="tg-row-icon text-neon">
              <Rocket size={19} />
            </span>
            <span className="tg-row-body">
              <span className="tg-row-title">یک حساب بساز، همه‌چیز را باز کن</span>
              <span className="tg-row-sub">
                پیشرفتت ذخیره می‌شود، تخفیف می‌گیری و در کامیونیتی شرکت می‌کنی
              </span>
            </span>
            <ChevronLeft size={18} className="shrink-0 text-locked" />
          </Link>
        </HomeSection>
      )}
    </div>
  );
}

/* ─────────────────────── Shared mobile section ───────────────────────── */

function HomeSection({
  title,
  to,
  linkLabel,
  children,
}: {
  title: string;
  to: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center justify-between px-4 pb-1.5 pt-5">
        <h2 className="text-[13px] font-medium text-muted">{title}</h2>
        <Link to={to} className="flex items-center gap-0.5 text-[13px] font-medium text-neon">
          {linkLabel}
          <ChevronLeft size={13} />
        </Link>
      </div>
      <div className="tg-group">{children}</div>
    </section>
  );
}
