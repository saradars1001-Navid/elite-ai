import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Lock,
  PlayCircle,
  FileText,
  Dumbbell,
  ClipboardCheck,
  Rocket,
  Star,
  Users,
  Clock,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ShieldCheck,
  BadgePercent,
  GraduationCap,
  Award,
  PenLine,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { exerciseTypeLabel, levelStyles } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, discountPercent, hours, price, toFa } from "../lib/utils";
import { Progress, Tabs, Stars } from "../components/ui";

export default function ChapterDetail() {
  const { chapterId } = useParams();
  const navigate = useNavigate();
  const {
    user,
    hasAccess,
    chapterProgress,
    isLessonComplete,
    getExerciseStatus,
    bestExamScore,
    state,
    activeDiscount,
    chapters,
  } = useApp();
  const ch = chapters.find((c) => c.id === chapterId);
  const [tab, setTab] = useState("lessons");

  if (!ch) {
    return <div className="container-x py-20 text-center text-muted">فصل پیدا نشد.</div>;
  }

  const owned = ch.free || hasAccess(ch.id);
  const progress = chapterProgress(ch.id);
  const isPurchased = state.purchases.some((p) => p.chapterId === ch.id && p.status === "موفق");
  const finalPrice = Math.round(
    (ch.price * (100 - (activeDiscount?.chapterId === ch.id ? activeDiscount.percent : 0))) / 100
  );

  const previewCount = ch.free ? ch.lessons.length : ch.previewCount;
  const freeLessons = ch.lessons.slice(0, previewCount);

  const tabs = [
    { id: "lessons", label: "درس‌ها", count: ch.lessons.length },
    { id: "exercises", label: "تمرین‌ها", count: ch.exercises.length },
    { id: "exam", label: "آزمون پایان فصل" },
    { id: "project", label: "پروژه نهایی" },
  ];

  return (
    <div className="container-x py-8 sm:py-12">
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="مسیر">
        <Link to="/" className="hover:text-sky">
          خانه
        </Link>
        <ChevronLeft size={13} />
        <Link to="/chapters" className="hover:text-sky">
          فصل‌ها
        </Link>
        <ChevronLeft size={13} />
        <span className="text-text">فصل {toFa(ch.index)}</span>
      </nav>

      {/* header */}
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className={cls("absolute inset-x-0 top-0 h-1", ch.gradient)} />
        <div className="bg-grid absolute inset-0 opacity-40" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-sky">فصل {toFa(ch.index)}</span>
              <span className={cls("chip", levelStyles[ch.level])}>{ch.level}</span>
              {ch.free && (
                <span className="chip border border-teal/25 bg-teal/10 text-teal">رایگان</span>
              )}
              {isPurchased && (
                <span className="chip border border-sky/25 bg-sky/10 text-sky">خریداری‌شده</span>
              )}
              {!ch.free && !owned && (
                <span className="chip border border-line bg-surface2 text-locked">قفل</span>
              )}
            </div>
            <h1 className="text-2xl font-black leading-snug sm:text-3xl">{ch.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-8 text-muted sm:text-base sm:leading-9">
              {ch.description}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} className="text-sky" /> {toFa(ch.lessons.length)} درس
              </span>
              <span className="flex items-center gap-1.5">
                <Dumbbell size={14} className="text-sky" /> {toFa(ch.exercises.length)} تمرین
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-sky" /> {hours(ch.duration)}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-sky" /> {toFa(ch.students.toLocaleString())} دانشجو
              </span>
              <span className="flex items-center gap-1.5">
                <Star size={14} className="fill-warn text-warn" /> {toFa(ch.rating)}{" "}
                <Stars rating={ch.rating} size={11} />
              </span>
            </div>

            {/* instructor */}
            <div className="mt-5 flex items-center gap-3 rounded-lg border border-line/50 bg-surface2/50 px-4 py-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-neon to-sky text-sm font-black text-white">
                {ch.instructor.name[0]}
              </span>
              <div>
                <p className="text-sm font-bold">{ch.instructor.name}</p>
                <p className="text-xs text-muted">{ch.instructor.role}</p>
              </div>
              <span className="chip mr-auto border border-warn/25 bg-warn/10 text-warn">
                <GraduationCap size={13} /> مدرس ایلیت
              </span>
            </div>
          </div>

          {/* purchase card */}
          <div className="w-full shrink-0 space-y-4 lg:w-80">
            <div className="rounded-lg border border-line/60 bg-surface2/60 p-5">
              {ch.free ? (
                <>
                  <p className="text-2xl font-black text-teal">رایگان</p>
                  <p className="mt-1 text-xs text-muted">
                    دسترسی کامل به تمام درس‌ها بدون نیاز به خرید
                  </p>
                </>
              ) : owned ? (
                <>
                  <p className="flex items-center gap-2 text-lg font-black text-teal">
                    <CheckCircle2 size={20} /> فعال
                  </p>
                  <p className="mt-1 text-xs text-muted">شما به این فصل دسترسی دارید.</p>
                </>
              ) : (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted">قیمت اصلی</p>
                      <p className="text-xl font-black">{price(ch.price)}</p>
                    </div>
                    {ch.oldPrice && (
                      <span className="chip border border-teal/25 bg-teal/10 text-teal">
                        {toFa(discountPercent(ch.oldPrice, ch.price))}٪ تخفیف
                      </span>
                    )}
                  </div>
                  {ch.oldPrice && (
                    <p className="mt-1 text-xs text-locked line-through">{price(ch.oldPrice)}</p>
                  )}
                </>
              )}

              {!owned && !ch.free && (
                <>
                  <div className="mt-4 space-y-1.5 border-t border-line/60 pt-4 text-xs text-muted">
                    <p className="flex items-center justify-between">
                      <span>قیمت نهایی</span>
                      <b className="text-text">{price(finalPrice)}</b>
                    </p>
                    {activeDiscount?.chapterId === ch.id && (
                      <p className="flex items-center justify-between text-teal">
                        <span className="flex items-center gap-1">
                          <BadgePercent size={13} /> تخفیف عملکردی
                        </span>
                        <b>٪{toFa(activeDiscount.percent)}</b>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/checkout/${ch.id}`)}
                    className="btn-primary btn-lg mt-4 w-full"
                  >
                    خرید این فصل
                  </button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-locked">
                    <ShieldCheck size={13} className="text-teal" /> پرداخت امن — فعال‌سازی آنی
                  </p>
                </>
              )}

              {!user && !owned && (
                <Link to="/auth" className="btn-secondary btn-md mt-3 w-full">
                  برای خرید ابتدا وارد شوید
                </Link>
              )}

              {owned && (
                <button
                  onClick={() => navigate(`/chapters/${ch.id}/lessons/${freeLessons[0].id}`)}
                  className="btn-primary btn-lg mt-4 w-full"
                >
                  <PlayCircle size={19} /> {progress > 0 ? "ادامه یادگیری" : "شروع فصل"}
                </button>
              )}
              {owned && progress > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-muted">
                    <span>پیشرفت شما</span>
                    <span className="font-bold text-sky">{toFa(progress)}٪</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}
            </div>

            {/* completion rate */}
            <div className="rounded-lg border border-line/60 bg-surface p-4 text-xs text-muted">
              <div className="flex items-center justify-between">
                <span>میانگین تکمیل کاربران</span>
                <b className="text-text">{toFa(ch.completionRate)}٪</b>
              </div>
              <Progress value={ch.completionRate} className="mt-2 h-1.5" color="bg-teal" />
              {bestExamScore(ch.id) > 0 && (
                <p className="mt-3 flex items-center justify-between border-t border-line/50 pt-3">
                  <span>بهترین نمره آزمون شما</span>
                  <b className="text-sky">{toFa(bestExamScore(ch.id))} از ۱۰۰</b>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* info strip */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <ListChecks size={17} className="text-sky" /> پیش‌نیازها
          </h3>
          {ch.prerequisites.length === 0 ? (
            <p className="text-sm text-muted">بدون پیش‌نیاز — برای همه مناسب است.</p>
          ) : (
            <ul className="space-y-2 text-sm text-muted">
              {ch.prerequisites.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-teal" /> {p}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <Award size={17} className="text-warn" /> خروجی نهایی فصل
          </h3>
          <ul className="space-y-2 text-sm text-muted">
            {ch.outcome.map((o) => (
              <li key={o} className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-teal" /> {o}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-8">
        <Tabs items={tabs} active={tab} onChange={setTab} />

        {/* ── Lessons ── */}
        {tab === "lessons" && (
          <div className="mt-5 space-y-2.5 animate-fade-in">
            {ch.lessons.map((l) => {
              const canView = l.free || owned;
              const done = isLessonComplete(l.id);
              return (
                <Link
                  key={l.id}
                  to={canView ? `/chapters/${ch.id}/lessons/${l.id}` : `/chapters/${ch.id}`}
                  onClick={(e) => {
                    if (!canView) {
                      e.preventDefault();
                      setTab("lessons");
                      // scroll to purchase card
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className={cls(
                    "flex items-center gap-4 rounded-lg border px-4 py-3.5 transition-colors",
                    canView
                      ? "border-line/50 bg-surface hover:border-neon/40"
                      : "border-line/40 bg-surface/50 opacity-70"
                  )}
                >
                  <span
                    className={cls(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      done
                        ? "bg-teal/15 text-teal"
                        : canView
                          ? "bg-navy text-sky"
                          : "bg-surface2 text-locked"
                    )}
                  >
                    {done ? (
                      <CheckCircle2 size={18} />
                    ) : canView ? (
                      l.kind === "video" ? (
                        <PlayCircle size={18} />
                      ) : (
                        <FileText size={17} />
                      )
                    ) : (
                      <Lock size={15} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cls("truncate text-sm font-bold", !canView && "text-locked")}>
                      درس {toFa(l.index)}: {l.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">{l.summary}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {!canView && (
                      <span className="chip border border-line bg-surface2 text-locked">
                        نمونه رایگان پیش از خرید
                      </span>
                    )}
                    {canView && l.free && !ch.free && (
                      <span className="chip border border-teal/25 bg-teal/10 text-teal">
                        نمونه رایگان
                      </span>
                    )}
                    {canView && l.free && ch.free && (
                      <span className="chip border border-teal/25 bg-teal/10 text-teal">
                        رایگان
                      </span>
                    )}
                    <span className="hidden text-xs text-muted sm:block">
                      {toFa(l.duration)} دقیقه
                    </span>
                    {canView && <ChevronLeft size={16} className="text-locked" />}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Exercises ── */}
        {tab === "exercises" && (
          <div className="mt-5 space-y-2.5 animate-fade-in">
            {ch.exercises.map((ex) => {
              const st = getExerciseStatus(ex.id);
              const canDo = ex.chapterId === ch.id && owned;
              return (
                <Link
                  key={ex.id}
                  to={canDo ? `/chapters/${ch.id}/exercises/${ex.id}` : `/chapters/${ch.id}`}
                  onClick={(e) => {
                    if (!canDo) {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="flex items-center gap-4 rounded-lg border border-line/50 bg-surface px-4 py-3.5 transition-colors hover:border-neon/40"
                >
                  <span
                    className={cls(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      st ? "bg-teal/15 text-teal" : "bg-navy text-sky"
                    )}
                  >
                    {st ? <CheckCircle2 size={18} /> : <Dumbbell size={17} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      تمرین {toFa(ex.index)}: {ex.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <span>{exerciseTypeLabel(ex.type)}</span>
                      <span>•</span>
                      <span>{toFa(ex.points)} امتیاز</span>
                      {st && <span className="text-teal">• {st.status}</span>}
                    </p>
                  </div>
                  {!owned && <Lock size={15} className="text-locked" />}
                  {owned && <ChevronLeft size={16} className="text-locked" />}
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Exam ── */}
        {tab === "exam" && (
          <div className="mt-5 animate-fade-in">
            <div className="card grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
              <div className="space-y-4">
                <h3 className="text-lg font-bold">{ch.exam.title}</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <ClipboardCheck size={16} className="text-sky" />{" "}
                    {toFa(ch.exam.questionCount ?? ch.exam.questions.length)} سؤال
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={16} className="text-sky" /> {toFa(ch.exam.durationMinutes)} دقیقه
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Award size={16} className="text-warn" /> حداقل قبولی {toFa(ch.exam.passScore)}
                  </span>
                </div>
                <div className="rounded-lg border border-teal/25 bg-teal/5 p-4 text-sm leading-7 text-muted">
                  <p className="mb-1 font-bold text-teal flex items-center gap-1.5">
                    <BadgePercent size={15} /> سیستم تخفیف عملکردی
                  </p>
                  ۹۰ تا ۱۰۰: تخفیف ۳۰٪ — ۸۰ تا ۸۹: تخفیف ۲۰٪ — ۷۰ تا ۷۹: تخفیف ۱۰٪. تخفیف فقط برای
                  فصل بعدی، به‌مدت ۱۴ روز و غیرقابل انتقال است.
                </div>
                {bestExamScore(ch.id) > 0 && (
                  <p className="text-sm text-muted">
                    آخرین نمره شما: <b className="text-sky">{toFa(bestExamScore(ch.id))} از ۱۰۰</b>
                  </p>
                )}
              </div>
              <div className="flex items-center">
                <button
                  onClick={() => owned && navigate(`/chapters/${ch.id}/exam`)}
                  disabled={!owned}
                  className={cls(
                    owned ? "btn-primary" : "btn-secondary",
                    "btn-lg w-full sm:w-auto"
                  )}
                >
                  {owned ? (
                    "شروع آزمون"
                  ) : (
                    <>
                      <Lock size={16} /> ابتدا فصل را بخرید
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Project ── */}
        {tab === "project" && (
          <div className="mt-5 animate-fade-in">
            <div className="card p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-warn/15 text-warn">
                  <Rocket size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-bold">{ch.project.title}</h3>
                  <p className="text-xs text-muted">پروژه پایانی این فصل</p>
                </div>
              </div>
              <p className="text-sm leading-8 text-muted">{ch.project.description}</p>
              <h4 className="mt-6 mb-3 font-bold">مراحل انجام</h4>
              <ol className="space-y-2.5">
                {ch.project.tasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm leading-7 text-muted">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neon/15 text-xs font-bold text-sky">
                      {toFa(i + 1)}
                    </span>
                    {t}
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex flex-wrap gap-2">
                {ch.project.tools.map((t) => (
                  <span key={t} className="chip border border-line bg-surface2 text-muted">
                    <Sparkles size={12} className="text-sky" /> {t}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-line/50 bg-surface2/50 px-4 py-3 text-sm">
                <PenLine size={16} className="text-teal" />
                <span>
                  <b>تحویل:</b> {ch.project.deliverable}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
