import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Heart,
  Bookmark,
  MessageCircle,
  ChevronRight,
  Flag,
  BadgeCheck,
  Tag,
  Send,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { useApp } from "../lib/store";
import { cls, toFa, timeAgo } from "../lib/utils";
import { Avatar, EmptyState } from "../components/ui";

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const {
    user,
    state,
    toggleLike,
    toggleSave,
    reportPost,
    addComment,
    communityPosts,
    communityComments,
  } = useApp();
  const [comment, setComment] = useState("");
  const [reported, setReported] = useState(false);
  const [sent, setSent] = useState(false);

  const post = useMemo(() => communityPosts.find((p) => p.id === postId), [postId, communityPosts]);
  const comments = useMemo(
    () =>
      communityComments
        .filter((c) => c.postId === postId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [postId, communityComments]
  );

  if (!post) {
    return (
      <div className="container-x py-16">
        <EmptyState
          icon={<MessageCircle size={24} />}
          title="پست پیدا نشد"
          text="ممکن است پست حذف شده باشد."
          action={
            <Link to="/community" className="btn-secondary btn-md">
              بازگشت به کامیونیتی
            </Link>
          }
        />
      </div>
    );
  }

  const liked = (state.postLikes[post.id] || 0) > 0;
  const saved = state.savedPosts.includes(post.id);
  const totalLikes = post.likes + (state.postLikes[post.id] || 0);

  return (
    <div className="container-x max-w-3xl py-8 sm:py-10">
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted" aria-label="مسیر">
        <Link to="/" className="hover:text-sky">
          خانه
        </Link>
        <ChevronRight size={12} />
        <Link to="/community" className="hover:text-sky">
          کامیونیتی
        </Link>
        <ChevronRight size={12} />
        <span className="line-clamp-1 text-text">{post.title}</span>
      </nav>

      <article className="card p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={post.author.name} size="lg" />
            <div>
              <p className="flex items-center gap-1.5 font-bold">
                {post.author.name}
                {post.author.expert && (
                  <span className="flex items-center gap-0.5 text-[11px] text-teal">
                    <BadgeCheck size={14} /> مدرس
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                {post.author.role} • {timeAgo(post.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip border border-sky/25 bg-sky/10 text-sky">
              <Tag size={11} /> {post.category}
            </span>
            {post.status === "closed" && (
              <span className="chip border border-line bg-surface2 text-locked">بحث بسته شد</span>
            )}
          </div>
        </div>

        <h1 className="mt-6 text-xl font-black leading-9 sm:text-2xl">{post.title}</h1>
        <div className="mt-3 whitespace-pre-wrap text-[15px] leading-9 text-text/90">
          {post.body}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span
              key={t}
              className="chip border border-line/60 bg-surface2/50 text-[11px] text-muted"
            >
              #{t}
            </span>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-1 border-t border-line/50 pt-4">
          <button
            onClick={() => (user ? toggleLike(post.id) : navigate("/auth"))}
            className={cls(
              "flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              liked ? "text-danger bg-danger/10" : "text-muted hover:bg-surface2"
            )}
          >
            <Heart size={17} className={liked ? "fill-danger" : ""} /> {toFa(totalLikes)}
          </button>
          <button
            onClick={() => (user ? toggleSave(post.id) : navigate("/auth"))}
            className={cls(
              "flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
              saved ? "text-sky bg-sky/10" : "text-muted hover:bg-surface2"
            )}
          >
            <Bookmark size={17} className={saved ? "fill-sky" : ""} />{" "}
            {saved ? "ذخیره‌شده" : "ذخیره"}
          </button>
          <button
            onClick={() => {
              reportPost(post.id);
              setReported(true);
            }}
            className="flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface2"
          >
            <Flag size={16} /> گزارش
          </button>
        </div>
        {reported && (
          <p className="mt-2 text-[11px] text-teal animate-fade-in">
            گزارش شما ثبت شد؛ توسط تیم مدیریت بررسی می‌شود.
          </p>
        )}
      </article>

      {/* comments */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <MessageCircle size={18} className="text-sky" /> پاسخ‌ها ({toFa(comments.length)})
        </h2>

        {/* reply box */}
        {user ? (
          <div className="card mb-5 p-4">
            <div className="flex items-start gap-3">
              <Avatar name={user.name} size="md" />
              <div className="min-w-0 flex-1">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="پاسخ خود را بنویسید…"
                  className="input resize-none"
                />
                {sent && <p className="mt-2 text-[11px] text-teal">پاسخ شما ثبت شد</p>}
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  if (comment.trim().length < 3) return;
                  addComment(post.id, comment.trim());
                  setComment("");
                  setSent(true);
                  setTimeout(() => setSent(false), 2000);
                }}
                disabled={comment.trim().length < 3}
                className="btn-primary btn-md"
              >
                <Send size={15} /> ارسال پاسخ
              </button>
            </div>
          </div>
        ) : (
          <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm text-muted">برای پاسخ‌دادن وارد شوید.</p>
            <Link to="/auth" className="btn-secondary btn-md">
              <Lock size={14} /> ورود / ثبت‌نام
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start gap-3">
                <Avatar name={c.author.name} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">
                      {c.author.name}
                      {c.author.expert && (
                        <BadgeCheck size={13} className="mr-1 inline text-teal" />
                      )}
                    </p>
                    <span className="text-[11px] text-muted">
                      {c.author.role} • {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-8 text-muted">{c.body}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      onClick={() => (user ? toggleLike(c.postId) : navigate("/auth"))}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted transition-colors hover:bg-surface2"
                    >
                      <Heart size={13} /> {toFa(c.likes)}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="card p-8 text-center text-sm text-muted">
              هنوز پاسخی ثبت نشده است. اولین نفر باشید!
            </p>
          )}
        </div>
      </div>

      <Link to="/community" className="btn-ghost btn-md mt-8">
        <ArrowLeft size={15} /> بازگشت به کامیونیتی
      </Link>
    </div>
  );
}
