import { ChGlyph } from "../lib/entityIcons";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Search, BadgePercent } from "lucide-react";
import type { Level } from "../lib/types";
import { useApp } from "../lib/store";
import { cls, hours, price, toFa } from "../lib/utils";

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

  const discountChapter = activeDiscount
    ? chapters.find((c) => c.id === activeDiscount.chapterId)
    : undefined;

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-4">
      <header className="pb-3">
        <h1 className="text-[22px] font-semibold leading-8 max-lg:hidden">فصل‌های آموزشی</h1>
        <p className="mt-1 text-[13px] leading-6 text-muted">
          هر فصل مستقل قابل خرید است. فصل اول رایگان؛ با نمره خوب در آزمون‌ها تخفیف واقعی بگیرید.
        </p>
      </header>

      {activeDiscount && (
        <Link
          to={`/checkout/${activeDiscount.chapterId}`}
          className="mb-3 flex items-center gap-2.5 rounded-xl bg-teal/10 px-3.5 py-3 text-[13px] text-teal"
        >
          <BadgePercent size={17} className="shrink-0" />
          <span>
            تخفیف <b>٪{toFa(activeDiscount.percent)}</b> برای فصل{" "}
            {toFa(discountChapter?.index ?? "")} فعال است
          </span>
        </Link>
      )}

      {/* filters */}
      <div className="tg-tabs -mx-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cls("tg-tab-item", filter === f.id && "active")}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative mb-3 mt-3">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-locked" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در فصل‌ها…"
          className="input !pr-10"
        />
      </div>

      {/* list */}
      <div className="tg-group max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
        {list.map((ch) => {
          const owned = ch.free || hasAccess(ch.id);
          const locked = !owned;
          const progress = chapterProgress(ch.id);
          const isPurchased = state.purchases.some(
            (p) => p.chapterId === ch.id && p.status === "موفق"
          );
          const status = locked
            ? "خرید"
            : progress >= 100
              ? "تکمیل‌شده"
              : progress > 0
                ? `${toFa(progress)}٪ پیشرفت`
                : isPurchased
                  ? "خریداری‌شده"
                  : `سطح ${ch.level}`;
          return (
            <Link key={ch.id} to={`/chapters/${ch.id}`} className="tg-row">
              <span
                className={cls(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full text-[19px]",
                  locked ? "bg-surface2 text-locked" : "bg-neon/10"
                )}
              >
                {locked ? <Lock size={17} /> : <ChGlyph id={ch.id} size={17} />}
              </span>
              <span className="tg-row-body">
                <span className="tg-row-title">
                  فصل {toFa(ch.index)} · {ch.title}
                </span>
                <span className="tg-row-sub">
                  {toFa(ch.lessons.length)} درس · {hours(ch.duration)}
                </span>
                {!locked && progress > 0 && (
                  <span className="tg-rail">
                    <span style={{ width: `${progress}%` }} />
                  </span>
                )}
              </span>
              <span className="shrink-0 text-left">
                <span className="block text-[13px] font-medium tabular-nums">
                  {ch.free ? "رایگان" : price(ch.price)}
                </span>
                <span className="block text-[11px] text-locked">{status}</span>
              </span>
            </Link>
          );
        })}
        {list.length === 0 && (
          <div className="tg-row text-[13px] text-muted">نتیجه‌ای برای جست‌وجوی شما پیدا نشد.</div>
        )}
      </div>

      {!user && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-4 shadow-card">
          <div className="min-w-0">
            <p className="text-[15px] font-medium">برای ذخیره پیشرفت وارد شوید</p>
            <p className="mt-0.5 text-[13px] text-muted">ورود فقط با شماره موبایل — چند ثانیه.</p>
          </div>
          <Link to="/auth" className="btn-primary btn-sm shrink-0">
            ورود
          </Link>
        </div>
      )}
    </div>
  );
}
