import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  ExternalLink,
  Star,
  CheckCircle2,
  Filter,
  BadgePercent,
  Globe,
  GraduationCap,
  Clock,
  ChevronLeft,
} from "lucide-react";
import { toolCategoryIcon } from "../lib/entityIcons";
import { TOOL_CATEGORIES } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, toFa } from "../lib/utils";
import { Modal, EmptyState, Stars } from "../components/ui";
import type { AiTool } from "../lib/types";

const PRICING_STYLE = {
  رایگان: "border border-teal/25 bg-teal/10 text-teal",
  پولی: "border border-warn/25 bg-warn/10 text-warn",
  "رایگان + پولی": "border border-sky/25 bg-sky/10 text-sky",
} as const;

const LEVEL_STYLE = {
  آسان: "border border-teal/25 bg-teal/10 text-teal",
  متوسط: "border border-warn/25 bg-warn/10 text-warn",
  حرفهای: "border border-danger/25 bg-danger/10 text-danger",
} as const;

export default function Tools() {
  const { aiTools, chapters } = useApp();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("همه");
  const [pricing, setPricing] = useState("همه");
  const [level, setLevel] = useState("همه");
  const [minRating, setMinRating] = useState(0);
  const [onlyNew, setOnlyNew] = useState(false);
  const [detail, setDetail] = useState<AiTool | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const list = useMemo(
    () =>
      aiTools.filter((t) => {
        const mQ =
          !query ||
          t.name.includes(query) ||
          t.description.includes(query) ||
          t.tagline.includes(query) ||
          t.useCases.some((u) => u.includes(query));
        const mC = cat === "همه" || t.category === cat;
        const mP = pricing === "همه" || t.pricing === pricing;
        const mL = level === "همه" || t.level === level;
        const mR = t.rating >= minRating;
        const mN = !onlyNew || t.isNew;
        return mQ && mC && mP && mL && mR && mN;
      }),
    [query, cat, pricing, level, minRating, onlyNew, aiTools]
  );

  return (
    <div className="tg-page px-4 py-4">
      <div className="mb-4">
        <div className="max-lg:hidden">
          <span className="chip mb-3 border border-neon/25 bg-neon/10 text-sky">
            دایرکتوری ابزارها
          </span>
          <h1 className="text-2xl font-black sm:text-3xl">بانک ابزارهای هوش مصنوعی</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted max-lg:mt-0">
          {toFa(aiTools.length)} ابزار بررسی‌شده با اطلاعات به‌روز؛ دسته‌بندی، قیمت، سطح کاربری و
          آموزش‌های مرتبط در پلتفرم.
        </p>
      </div>

      {/* search + filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-locked" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی ابزار، کاربرد یا دسته…"
            className="input !pr-11"
          />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cls("btn-secondary btn-md", filtersOpen && "border-neon/50 text-sky")}
        >
          <Filter size={15} /> فیلترها
          {(pricing !== "همه" || level !== "همه" || minRating > 0 || onlyNew) && (
            <span className="grid h-4 w-4 place-items-center rounded-full bg-neon text-[9px] text-white">
              •
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="card mb-6 grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4 animate-slide-up">
          <div>
            <label className="mb-2 block text-xs font-bold text-muted">دسته‌بندی</label>
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="input !py-2.5 text-sm"
            >
              <option>همه</option>
              {TOOL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-muted">مدل قیمت‌گذاری</label>
            <select
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              className="input !py-2.5 text-sm"
            >
              <option>همه</option>
              <option>رایگان</option>
              <option>پولی</option>
              <option>رایگان + پولی</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-muted">سطح کاربری</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="input !py-2.5 text-sm"
            >
              <option>همه</option>
              <option>آسان</option>
              <option>متوسط</option>
              <option>حرفهای</option>
            </select>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs font-bold text-muted">حداقل امتیاز</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-full accent-[#F59E0B]"
                  dir="ltr"
                />
                <span className="shrink-0 text-xs font-bold text-warn">{toFa(minRating)}</span>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={onlyNew}
                onChange={(e) => setOnlyNew(e.target.checked)}
                className="h-4 w-4 accent-[#3B82F6]"
              />
              فقط ابزارهای جدید
            </label>
          </div>
        </div>
      )}

      {/* category quick chips */}
      <div className="no-scrollbar mb-8 flex gap-1.5 overflow-x-auto pb-1">
        {TOOL_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(cat === c ? "همه" : c)}
            className={cls(
              "shrink-0 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors",
              cat === c
                ? "border-neon/50 bg-neon/15 text-sky"
                : "border-line/60 bg-surface text-muted hover:border-neon/30 hover:text-text"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* tools grid */}
      {list.length === 0 ? (
        <EmptyState
          icon={<Search size={24} />}
          title="ابزاری پیدا نشد"
          text="فیلترها را تغییر دهید یا عبارت دیگری جست‌وجو کنید."
        />
      ) : (
        <div className="tg-group max-lg:-mx-1 lg:rounded-xl lg:shadow-card">
          {list.map((t) => (
            <button key={t.id} onClick={() => setDetail(t)} className="tg-row">
              <span className="tg-row-icon !h-11 !w-11 rounded-xl bg-navy">
                <ToolIcon category={t.category} />
              </span>
              <span className="tg-row-body">
                <span className="tg-row-title">{t.name}</span>
                <span className="tg-row-sub">{t.tagline}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={cls("chip", PRICING_STYLE[t.pricing])}>
                    <BadgePercent size={11} /> {t.pricing}
                  </span>
                  <span className={cls("chip", LEVEL_STYLE[t.level])}>
                    <GraduationCap size={11} /> {t.level}
                  </span>
                  {t.isNew && (
                    <span className="chip border border-teal/25 bg-teal/10 text-teal">جدید</span>
                  )}
                  <span className="ms-auto flex items-center gap-1 text-[11px] text-muted">
                    <Stars rating={t.rating} size={11} />
                    <b className="text-text">{toFa(t.rating)}</b>
                  </span>
                </span>
              </span>
              <ChevronLeft size={16} className="shrink-0 text-locked" />
            </button>
          ))}
        </div>
      )}

      {/* detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name} wide>
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy">
                <ToolIcon category={detail.category} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black">{detail.name}</h3>
                <p className="text-sm text-muted">{detail.tagline}</p>
              </div>
              <a
                href={detail.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary btn-md shrink-0"
              >
                سایت رسمی <ExternalLink size={14} />
              </a>
            </div>

            <p className="text-sm leading-8 text-muted">{detail.description}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-line/60 bg-surface2/50 p-4">
                <p className="mb-2 text-xs font-bold text-muted">کاربردها</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.useCases.map((u) => (
                    <span key={u} className="chip border border-line bg-surface text-muted">
                      {u}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-line/60 bg-surface2/50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted">
                  <Globe size={12} /> زبان‌های پشتیبانی‌شده
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.languages.map((l) => (
                    <span key={l} className="chip border border-line bg-surface text-muted">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
              <span>
                دسته‌بندی: <b className="text-text">{detail.category}</b>
              </span>
              <span>
                نوع خروجی: <b className="text-text">{detail.output}</b>
              </span>
              <span>
                قیمت: <b className="text-text">{detail.pricing}</b>
              </span>
              <span className="flex items-center gap-1">
                <Clock size={13} /> آخرین بررسی: <b className="text-text">{detail.reviewedAt}</b>
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-line/50 bg-surface2/40 px-4 py-3">
              <span className="flex items-center gap-1 text-sm">
                <Star size={15} className="fill-warn text-warn" /> امتیاز کاربران:
                <b className="text-text">{toFa(detail.rating)}</b> از{" "}
                {toFa(detail.reviews.toLocaleString())} نظر
              </span>
            </div>

            {detail.relatedLessons.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold text-muted">آموزش‌های مرتبط در پلتفرم</p>
                <div className="space-y-2">
                  {detail.relatedLessons.map((lid) => {
                    const ch = chapters.find((c) => c.lessons.some((l) => l.id === lid));
                    const l = ch?.lessons.find((x) => x.id === lid);
                    if (!ch || !l) return null;
                    return (
                      <Link
                        key={lid}
                        to={`/chapters/${ch.id}/lessons/${lid}`}
                        className="flex items-center gap-2.5 rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-2.5 text-xs text-muted transition-colors hover:border-neon/40 hover:text-text"
                      >
                        <CheckCircle2 size={14} className="shrink-0 text-sky" />
                        <span className="truncate">
                          {ch.title} — {l.title}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Tool category → lucide icon (was an emoji map). */
function ToolIcon({ category }: { category: string }) {
  const I = toolCategoryIcon(category);
  return <I size={19} />;
}
