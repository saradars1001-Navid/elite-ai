import { useMemo, useState } from "react";
import { Check, Copy, Flame, Heart, Search, Sparkles, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "../lib/store";
import { EmptyState } from "../components/ui";
import { cls, toFa, timeAgo } from "../lib/utils";
import type { TrendingPrompt } from "../lib/types";

const categories = ["همه", "تصویر", "ویدئو", "موسیقی", "پاورپوینت", "متن", "کدنویسی", "تحلیل"];

export default function PromptTrends() {
  const { trendingPrompts, incrementPromptEngagement } = useApp();
  const [category, setCategory] = useState("همه");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"trending" | "newest">("trending");
  const [copied, setCopied] = useState<string | null>(null);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trendingPrompts
      .filter(
        (p) =>
          p.status === "published" &&
          (category === "همه" || p.category === category) &&
          (!q || `${p.title} ${p.prompt} ${p.tool} ${p.tags.join(" ")}`.toLowerCase().includes(q))
      )
      .sort((a, b) =>
        sort === "trending"
          ? b.uses + b.likes * 2 - (a.uses + a.likes * 2)
          : b.createdAt.localeCompare(a.createdAt)
      );
  }, [trendingPrompts, category, query, sort]);
  const copy = async (p: TrendingPrompt) => {
    try {
      await navigator.clipboard.writeText(p.prompt);
    } catch {
      /* clipboard may be unavailable in preview */
    }
    setCopied(p.id);
    incrementPromptEngagement(p.id, "use");
    setTimeout(() => setCopied(null), 1600);
  };
  return (
    <div className="container-x py-8 sm:py-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip mb-3 border border-warn/25 bg-warn/10 text-warn">
            <Flame size={13} /> کتابخانه ترند
          </span>
          <h1 className="text-2xl font-black sm:text-3xl">پرامپت‌های محبوب این هفته</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            پرامپت‌های کاربردی برای تولید تصویر، ویدئو، موسیقی، پاورپوینت و بیشتر؛ آماده استفاده و
            قابل شخصی‌سازی.
          </p>
        </div>
        <Link to="/prompt-lab" className="btn-primary btn-md">
          <Wand2 size={15} /> تمرین در پرامپت‌لب
        </Link>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="relative block">
          <Search size={17} className="absolute right-3 top-3.5 text-locked" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pr-10"
            placeholder="جست‌وجوی پرامپت، ابزار یا تگ..."
          />
        </label>
        <div className="flex rounded-lg border border-line/60 bg-surface p-1">
          <button
            onClick={() => setSort("trending")}
            className={cls(
              "rounded-md px-4 py-2 text-xs",
              sort === "trending" ? "bg-neon/15 text-sky" : "text-muted"
            )}
          >
            محبوب‌ترین
          </button>
          <button
            onClick={() => setSort("newest")}
            className={cls(
              "rounded-md px-4 py-2 text-xs",
              sort === "newest" ? "bg-neon/15 text-sky" : "text-muted"
            )}
          >
            جدیدترین
          </button>
        </div>
      </div>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cls(
              "chip shrink-0 border px-4 py-2",
              category === c
                ? "border-neon/50 bg-neon/15 text-sky"
                : "border-line/60 bg-surface text-muted"
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={26} />}
          title="پرامپتی پیدا نشد"
          text="فیلتر یا عبارت جست‌وجو را تغییر بده."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p, i) => (
            <PromptCard
              key={p.id}
              prompt={p}
              rank={i + 1}
              copied={copied === p.id}
              onCopy={() => void copy(p)}
              onLike={() => incrementPromptEngagement(p.id, "like")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  rank,
  copied,
  onCopy,
  onLike,
}: {
  prompt: TrendingPrompt;
  rank: number;
  copied: boolean;
  onCopy: () => void;
  onLike: () => void;
}) {
  return (
    <article className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/50 bg-surface2/35 px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-bold text-warn">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-warn/10">
            {toFa(rank)}
          </span>
          <Flame size={14} /> {prompt.category}
        </span>
        <span className="text-[10px] text-muted">{timeAgo(prompt.createdAt)}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-black leading-7">{prompt.title}</h2>
            <p className="mt-1 text-xs text-muted">
              {prompt.tool} · {prompt.author}
            </p>
          </div>
          <Sparkles size={18} className="shrink-0 text-neon" />
        </div>
        <p className="mt-3 text-xs leading-6 text-muted">{prompt.description}</p>
        <div className="mt-4 rounded-lg border border-line/50 bg-base/60 p-3.5">
          <p className="whitespace-pre-wrap text-xs leading-7 text-text" dir="auto">
            {prompt.prompt}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {prompt.tags.map((t) => (
            <span key={t} className="text-[10px] text-sky">
              #{t}
            </span>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="text-[11px] text-muted">
            {toFa(prompt.uses)} استفاده · {toFa(prompt.likes)} پسند
          </span>
          <div className="flex gap-2">
            <button
              onClick={onLike}
              className="btn-ghost btn-sm !px-2 text-danger"
              aria-label="پسندیدن"
            >
              <Heart size={15} />
            </button>
            <button onClick={onCopy} className="btn-primary btn-sm">
              {copied ? (
                <>
                  <Check size={14} /> کپی شد
                </>
              ) : (
                <>
                  <Copy size={14} /> کپی پرامپت
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
