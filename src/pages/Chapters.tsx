import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Lock,
  CheckCircle2,
  PlayCircle,
  Star,
  Users,
  Clock,
  BookOpen,
  Dumbbell,
  Search,
  BadgePercent,
} from "lucide-react";
import { levelStyles } from "../lib/data";
import type { Level } from "../lib/types";
import { useApp } from "../lib/store";
import { cls, hours, price, toFa } from "../lib/utils";
import { Progress } from "../components/ui";

const FILTERS: { id: "all" | Level; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "مقدماتی", label: "مقدماتی" },
  { id: "متوسط", label: "متوسط" },
  { id: "پیشرفته", label: "پیشرفته" },
];

export default function Chapters() {
  const { user, hasAccess, chapterProgress, state, activeDiscount, chapters } = useApp();
  const [filter, setFilter] = useState<"all" | Level>("all");
  const [query, setQuery] = useState("");

  const list = useMemo(
    () =>
      chapters.filter((c) => {
        const matchLevel = filter === "all" || c.level === filter;
        const matchQ = !query || c.title.includes(query) || c.subtitle.includes(query);
        return matchLevel && matchQ;
      }),
    [filter, query, chapters]
  );

  return (
    <div className="container-x py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">مسیر یادگیری</span>
          <h1 className="text-2xl font-black sm:text-3xl">فصل‌های آموزشی</h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-muted">
            هر فصل به‌صورت مستقل قابل خرید است. فصل اول کاملاً رایگان؛ بعد از آن، با نمره خوب در
            آزمون‌ها تخفیف واقعی بگیرید.
          </p>
        </div>
        {activeDiscount && (
          <div className="flex items-center gap-2 rounded-lg border border-teal/25 bg-teal/10 px-4 py-2.5 text-sm">
            <BadgePercent size={17} className="text-teal" />
            <span>
              تخفیف <b>٪{toFa(activeDiscount.percent)}</b> برای{" "}
              <Link
                to={`/checkout/${activeDiscount.chapterId}`}
                className="font-bold text-teal underline"
              >
                فصل {toFa(chapters.find((c) => c.id === activeDiscount.chapterId)?.index ?? "")}
              </Link>
            </span>
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-line/60 bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cls(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.id ? "bg-neon/15 text-sky" : "text-muted hover:text-text"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-locked" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجو در فصل‌ها…"
            className="input !pr-10"
          />
        </div>
      </div>

      <div className="space-y-4">
        {list.map((ch) => {
          const owned = ch.free || hasAccess(ch.id);
          const locked = !owned;
          const progress = chapterProgress(ch.id);
          const isPurchased = state.purchases.some(
            (p) => p.chapterId === ch.id && p.status === "موفق"
          );
          return (
            <Link
              key={ch.id}
              to={`/chapters/${ch.id}`}
              className={cls(
                "card group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 sm:p-6",
                locked ? "" : "hover:border-neon/40 hover:shadow-glow-sm"
              )}
            >
              <div
                className={cls(
                  "absolute inset-y-0 right-0 w-1",
                  ch.gradient,
                  locked && "opacity-40"
                )}
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span
                  className={cls(
                    "grid h-14 w-14 shrink-0 place-items-center rounded-xl text-2xl",
                    locked ? "bg-surface2" : "bg-navy"
                  )}
                >
                  {locked ? <Lock size={20} className="text-locked" /> : ch.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-sky">فصل {toFa(ch.index)}</span>
                    <span className={cls("chip", levelStyles[ch.level])}>{ch.level}</span>
                    {ch.free && (
                      <span className="chip border border-teal/25 bg-teal/10 text-teal">
                        رایگان
                      </span>
                    )}
                    {isPurchased && (
                      <span className="chip border border-sky/25 bg-sky/10 text-sky">
                        خریداری‌شده
                      </span>
                    )}
                    {!ch.free && locked && (
                      <span className="chip border border-line bg-surface2 text-locked">قفل</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold transition-colors group-hover:text-sky sm:text-lg">
                    {ch.title}
                  </h3>
                  <p className="mt-1 text-sm leading-7 text-muted">{ch.subtitle}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <BookOpen size={13} /> {toFa(ch.lessons.length)} درس
                    </span>
                    <span className="flex items-center gap-1">
                      <Dumbbell size={13} /> {toFa(ch.exercises.length)} تمرین
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {hours(ch.duration)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} /> {toFa(ch.students.toLocaleString())} دانشجو
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={13} className="fill-warn text-warn" /> {toFa(ch.rating)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  {ch.free ? (
                    <span className="text-lg font-black text-teal">رایگان</span>
                  ) : (
                    <span className="text-left">
                      <span className="text-lg font-black">{price(ch.price)}</span>
                      {ch.oldPrice && (
                        <span className="mr-2 text-xs text-locked line-through">
                          {price(ch.oldPrice)}
                        </span>
                      )}
                    </span>
                  )}
                  {!locked && progress > 0 && (
                    <div className="w-36">
                      <div className="mb-1 flex justify-between text-[10px] text-muted">
                        <span>پیشرفت شما</span>
                        <span className="text-sky">{toFa(progress)}٪</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}
                  <span
                    className={cls(
                      "mt-1 flex items-center gap-1.5 text-sm font-bold",
                      locked ? "text-locked" : "text-neon"
                    )}
                  >
                    {locked ? (
                      <>
                        <Lock size={14} /> خرید فصل
                      </>
                    ) : (
                      <>
                        {progress >= 100 ? (
                          <CheckCircle2 size={15} className="text-teal" />
                        ) : (
                          <PlayCircle size={15} />
                        )}
                        {progress >= 100 ? "تکمیل‌شده" : "مشاهده فصل"}
                      </>
                    )}
                  </span>
                </div>
              </div>
              {!locked && progress > 0 && (
                <div className="mt-4 flex items-center gap-3 lg:hidden">
                  <Progress value={progress} className="flex-1" />
                  <span className="text-xs text-muted">{toFa(progress)}٪</span>
                </div>
              )}
            </Link>
          );
        })}
        {list.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">
            نتیجه‌ای برای جست‌وجوی شما یافت نشد.
          </div>
        )}
      </div>

      {!user && (
        <div className="card mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h3 className="font-bold">برای ذخیره پیشرفت، وارد شوید</h3>
            <p className="mt-1 text-sm text-muted">
              ورود فقط با شماره موبایل — چند ثانیه طول می‌کشد.
            </p>
          </div>
          <Link to="/auth" className="btn-primary btn-md">
            ورود / ثبت‌نام
          </Link>
        </div>
      )}
    </div>
  );
}
