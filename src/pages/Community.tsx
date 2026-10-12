import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  Bookmark,
  MessageCircle,
  Search,
  Plus,
  Flag,
  BadgeCheck,
  PenLine,
  Tag,
  MessageSquarePlus,
  Lock,
} from "lucide-react";
import { COMMUNITY_CATEGORIES } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, toFa, timeAgo } from "../lib/utils";
import { Avatar, Modal, Banner } from "../components/ui";

type Sort = "new" | "popular" | "unanswered";

export default function Community() {
  const { user, state, toggleLike, toggleSave, reportPost, addPost, communityPosts } = useApp();
  const navigate = useNavigate();
  const [cat, setCat] = useState<string>("همه");
  const [sort, setSort] = useState<Sort>("new");
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [reported, setReported] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(COMMUNITY_CATEGORIES[0]);
  const [tags, setTags] = useState("");
  const [posted, setPosted] = useState(false);

  const posts = useMemo(() => {
    const all = communityPosts;
    let list = all.filter((p) => {
      const matchCat = cat === "همه" || p.category === cat;
      const matchQ =
        !query ||
        p.title.includes(query) ||
        p.body.includes(query) ||
        p.tags.some((t) => t.includes(query));
      return matchCat && matchQ;
    });
    list = list.map((p) => ({
      ...p,
      likes: p.likes + (state.postLikes[p.id] || 0),
    }));
    if (sort === "popular") list = [...list].sort((a, b) => b.likes - a.likes);
    if (sort === "unanswered") list = [...list].sort((a, b) => a.commentsCount - b.commentsCount);
    if (sort === "new")
      list = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    return list;
  }, [cat, sort, query, state.postLikes, communityPosts]);

  const doReport = (id: string) => {
    reportPost(id);
    setReported(id);
    setTimeout(() => setReported(null), 1800);
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-4">
      <header className="flex items-end justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-8 max-lg:hidden">کامیونیتی</h1>
          <p className="mt-1 text-[13px] leading-6 text-muted">
            بپرس، تجربه‌ات را به‌اشتراک بگذار و با بقیه گفت‌وگو کن.
          </p>
        </div>
        <button
          onClick={() => {
            if (!user) return navigate("/auth");
            setNewOpen(true);
            setPosted(false);
          }}
          className="btn-primary btn-sm shrink-0"
        >
          <MessageSquarePlus size={15} /> پست جدید
        </button>
      </header>

      {/* categories */}
      <div className="tg-tabs -mx-4">
        {["همه", ...COMMUNITY_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cls("tg-tab-item", cat === c && "active")}
          >
            {c}
          </button>
        ))}
      </div>

      {/* search + sort */}
      <div className="relative mb-3 mt-3">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-locked" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در پست‌ها…"
          className="input !pr-10"
        />
      </div>
      <div className="mb-3 flex gap-1.5">
        {(
          [
            { id: "new", label: "جدیدترین" },
            { id: "popular", label: "محبوب‌ترین" },
            { id: "unanswered", label: "بی‌پاسخ" },
          ] as { id: Sort; label: string }[]
        ).map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={cls(
              "rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors",
              sort === s.id ? "bg-surface2 text-text" : "text-muted hover:text-text"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* posts */}
      <div className="space-y-3">
        {posts.map((p) => {
          const liked = (state.postLikes[p.id] || 0) > 0;
          const saved = state.savedPosts.includes(p.id);
          return (
            <article key={p.id} className="rounded-xl bg-surface p-4 shadow-card sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={p.author.name} size="md" />
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-bold">
                      {p.author.name}
                      {p.author.expert && (
                        <span className="flex items-center gap-0.5 text-[10px] text-teal">
                          <BadgeCheck size={13} /> مدرس
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted">
                      {p.author.role} • {timeAgo(p.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip hidden border border-sky/25 bg-sky/10 text-sky sm:inline-flex">
                    <Tag size={11} /> {p.category}
                  </span>
                  {p.status === "closed" && (
                    <span className="chip border border-line bg-surface2 text-locked">بسته</span>
                  )}
                  <button
                    onClick={() => doReport(p.id)}
                    className="btn-ghost btn-sm !px-2 text-locked"
                    title="گزارش محتوای نامناسب"
                    aria-label="گزارش"
                  >
                    <Flag size={15} />
                  </button>
                </div>
              </div>

              <Link to={`/community/${p.id}`} className="mt-4 block">
                <h3 className="mb-1.5 text-base font-black transition-colors hover:text-sky sm:text-lg">
                  {p.title}
                </h3>
                <p className="line-clamp-3 text-sm leading-7 text-muted">{p.body}</p>
              </Link>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="chip border border-line/60 bg-surface2/50 text-[11px] text-muted"
                  >
                    #{t}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-1 border-t border-line/50 pt-3.5">
                <button
                  onClick={() => (user ? toggleLike(p.id) : navigate("/auth"))}
                  className={cls(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    liked ? "text-danger" : "text-muted hover:bg-surface2"
                  )}
                >
                  <Heart size={15} className={liked ? "fill-danger" : ""} />
                  {toFa(p.likes + (state.postLikes[p.id] || 0))}
                </button>
                <Link
                  to={`/community/${p.id}`}
                  className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface2"
                >
                  <MessageCircle size={15} /> {toFa(p.commentsCount)}
                </Link>
                <button
                  onClick={() => (user ? toggleSave(p.id) : navigate("/auth"))}
                  className={cls(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    saved ? "text-sky" : "text-muted hover:bg-surface2"
                  )}
                >
                  <Bookmark size={15} className={saved ? "fill-sky" : ""} />
                  {saved ? "ذخیره‌شده" : "ذخیره"}
                </button>
                <Link
                  to={`/community/${p.id}`}
                  className="mr-auto flex items-center gap-1 text-xs font-bold text-sky hover:underline"
                >
                  پاسخ‌ها <PenLine size={13} />
                </Link>
              </div>
              {reported === p.id && (
                <p className="mt-2 text-[11px] text-teal animate-fade-in">
                  گزارش شما ثبت شد؛ توسط تیم مدیریت بررسی می‌شود.
                </p>
              )}
            </article>
          );
        })}
        {posts.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">
            پستی با این فیلترها پیدا نشد.
          </div>
        )}
      </div>

      {!user && (
        <div className="card mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h3 className="font-bold">برای مشارکت در کامیونیتی وارد شوید</h3>
            <p className="mt-1 text-sm text-muted">
              پرسیدن سؤال و پاسخ‌دهی فقط برای اعضا فعال است.
            </p>
          </div>
          <Link to="/auth" className="btn-primary btn-md">
            <Lock size={15} /> ورود / ثبت‌نام
          </Link>
        </div>
      )}

      {/* new post modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="پست جدید" wide>
        {posted ? (
          <Banner
            kind="success"
            title="پست شما منتشر شد"
            text="پست شما در کامیونیتی نمایش داده می‌شود."
          />
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="ptitle" className="label">
                عنوان پست
              </label>
              <input
                id="ptitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="سؤال یا موضوع خود را خلاصه بنویسید"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="pbody" className="label">
                متن پست
              </label>
              <textarea
                id="pbody"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="جزئیات سؤال، تجربه یا پروژه خود را بنویسید…"
                className="input resize-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">دسته‌بندی</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input"
                >
                  {COMMUNITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">تگ‌ها (با ویرگول)</label>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="پرامپت، ابزار، تجربه"
                  className="input"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (title.trim().length < 5 || body.trim().length < 10) return;
                  addPost(
                    title.trim(),
                    body.trim(),
                    category,
                    tags
                      .split(/[،,]/)
                      .map((t) => t.trim())
                      .filter(Boolean)
                  );
                  setPosted(true);
                  setTitle("");
                  setBody("");
                  setTags("");
                }}
                disabled={title.trim().length < 5 || body.trim().length < 10}
                className="btn-primary btn-md flex-1"
              >
                <Plus size={16} /> انتشار پست
              </button>
              <button onClick={() => setNewOpen(false)} className="btn-secondary btn-md">
                انصراف
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
