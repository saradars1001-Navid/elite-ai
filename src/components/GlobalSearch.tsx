import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Clock3,
  FileText,
  MessageCircle,
  Search,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../lib/store";
import { cls, toFa } from "../lib/utils";
import { isLaravelConfigured, laravelSearch } from "../lib/laravel";

type SearchKind = "chapter" | "lesson" | "tool" | "post";
type SearchResult = { id: string; kind: SearchKind; title: string; subtitle: string; to: string };

const kindMeta: Record<SearchKind, { label: string; icon: typeof BookOpen; tone: string }> = {
  chapter: { label: "فصل آموزشی", icon: BookOpen, tone: "text-sky bg-sky/10" },
  lesson: { label: "درس", icon: FileText, tone: "text-teal bg-teal/10" },
  tool: { label: "ابزار AI", icon: Wrench, tone: "text-[#A78BFA] bg-[#8B5CF6]/15" },
  post: { label: "پست کامیونیتی", icon: MessageCircle, tone: "text-warn bg-warn/10" },
};

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").trim();
}

export default function GlobalSearch() {
  const { chapters, aiTools, communityPosts } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 30);
    else setQuery("");
  }, [open]);

  useEffect(() => {
    if (!isLaravelConfigured() || normalize(query).length < 2) {
      setRemoteResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void laravelSearch(query)
        .then((items) => {
          if (controller.signal.aborted) return;
          setRemoteResults(
            items
              .filter((item) => ["chapter", "lesson", "tool", "post"].includes(item.type))
              .map((item) => ({
                id: item.id,
                kind: item.type as SearchKind,
                title: item.title,
                subtitle: item.description || "نتیجه از پایگاه داده",
                to: item.url,
              }))
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) setRemoteResults([]);
        });
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const results = useMemo(() => {
    if (isLaravelConfigured()) return remoteResults;
    const q = normalize(query);
    if (!q) return [];
    const matches = (value: string) => normalize(value).includes(q);
    const chaptersResults: SearchResult[] = chapters
      .filter((chapter) => matches(`${chapter.title} ${chapter.subtitle} ${chapter.description}`))
      .map((chapter) => ({
        id: chapter.id,
        kind: "chapter",
        title: chapter.title,
        subtitle: `فصل ${toFa(chapter.index)} · ${chapter.level}`,
        to: `/chapters/${chapter.id}`,
      }));
    const lessonResults: SearchResult[] = chapters.flatMap((chapter) =>
      chapter.lessons
        .filter((lesson) =>
          matches(`${lesson.title} ${lesson.summary} ${lesson.content.join(" ")}`)
        )
        .map((lesson) => ({
          id: lesson.id,
          kind: "lesson" as const,
          title: lesson.title,
          subtitle: `${chapter.title} · ${toFa(lesson.duration)} دقیقه`,
          to: `/chapters/${chapter.id}/lessons/${lesson.id}`,
        }))
    );
    const toolResults: SearchResult[] = aiTools
      .filter((tool) =>
        matches(
          `${tool.name} ${tool.tagline} ${tool.description} ${tool.category} ${tool.useCases.join(" ")}`
        )
      )
      .map((tool) => ({
        id: tool.id,
        kind: "tool",
        title: tool.name,
        subtitle: `${tool.category} · ${tool.pricing}`,
        to: "/tools",
      }));
    const postResults: SearchResult[] = communityPosts
      .filter((post) =>
        matches(`${post.title} ${post.body} ${post.category} ${post.tags.join(" ")}`)
      )
      .map((post) => ({
        id: post.id,
        kind: "post",
        title: post.title,
        subtitle: `${post.category} · ${post.author.name}`,
        to: `/community/${post.id}`,
      }));
    return [
      ...chaptersResults.slice(0, 4),
      ...lessonResults.slice(0, 6),
      ...toolResults.slice(0, 4),
      ...postResults.slice(0, 4),
    ];
  }, [aiTools, chapters, communityPosts, query, remoteResults]);

  const grouped = (Object.keys(kindMeta) as SearchKind[])
    .map((kind) => ({ kind, items: results.filter((result) => result.kind === kind) }))
    .filter((group) => group.items.length);
  const go = (result: SearchResult) => {
    setOpen(false);
    navigate(result.to);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex h-9 items-center gap-2 rounded-lg border border-line/60 bg-surface2/60 px-2.5 text-muted transition-colors hover:border-neon/50 hover:text-text lg:w-44 lg:justify-between lg:px-3"
        aria-label="جست‌وجوی سراسری"
      >
        <span className="flex items-center gap-2">
          <Search size={16} />
          <span className="hidden text-xs lg:inline">جست‌وجو در آکادمی</span>
        </span>
        <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-locked lg:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[10vh] sm:px-6">
          <button
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="بستن جست‌وجو"
          />
          <section
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-card animate-slide-up"
            role="dialog"
            aria-modal="true"
            aria-label="جست‌وجوی سراسری"
          >
            <div className="flex items-center gap-3 border-b border-line/60 px-4 py-3.5">
              <Search size={19} className="shrink-0 text-neon" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-locked"
                placeholder="فصل، درس، ابزار یا پست کامیونیتی را جست‌وجو کن..."
                aria-label="عبارت جست‌وجو"
              />
              <kbd className="hidden rounded border border-line bg-surface2 px-2 py-1 text-[10px] text-locked sm:inline">
                Esc
              </kbd>
              <button
                onClick={() => setOpen(false)}
                className="btn-ghost btn-sm !px-2"
                aria-label="بستن"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-3">
              {!query.trim() ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-neon/10 text-neon">
                    <Sparkles size={22} />
                  </span>
                  <p className="font-bold">همه‌چیز را یک‌جا پیدا کن</p>
                  <p className="text-xs leading-6 text-muted">
                    با میانبر Ctrl + K یا ⌘ + K هر زمان این جست‌وجو را باز کن.
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <span className="chip bg-surface2 text-muted">فصل‌های آموزشی</span>
                    <span className="chip bg-surface2 text-muted">درس‌ها</span>
                    <span className="chip bg-surface2 text-muted">ابزارهای AI</span>
                    <span className="chip bg-surface2 text-muted">کامیونیتی</span>
                  </div>
                </div>
              ) : grouped.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-bold">نتیجه‌ای پیدا نشد</p>
                  <p className="mt-2 text-xs text-muted">
                    املای عبارت یا دسته‌بندی دیگری را امتحان کن.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {grouped.map(({ kind, items }) => {
                    const meta = kindMeta[kind];
                    const Icon = meta.icon;
                    return (
                      <div key={kind}>
                        <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-bold text-muted">
                          <Icon size={14} /> {meta.label}{" "}
                          <span className="text-locked">({toFa(items.length)})</span>
                        </div>
                        <div className="space-y-1">
                          {items.map((result) => (
                            <button
                              key={`${result.kind}-${result.id}`}
                              onClick={() => go(result)}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition-colors hover:bg-surface2"
                            >
                              <span
                                className={cls(
                                  "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                                  meta.tone
                                )}
                              >
                                <Icon size={16} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-text">
                                  {result.title}
                                </span>
                                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                                  <Clock3 size={11} /> {result.subtitle}
                                </span>
                              </span>
                              <span className="text-xs text-locked">↵</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-line/60 bg-surface2/30 px-4 py-2.5 text-[10px] text-locked">
              <span>نتایج زنده از محتوای فعلی آکادمی</span>
              <span dir="ltr">Ctrl / ⌘ + K</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
