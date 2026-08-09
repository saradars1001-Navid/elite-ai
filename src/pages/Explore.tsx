import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Heart, Play, PlaySquare, Share2, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useApp } from "../lib/store";
import { Avatar, EmptyState } from "../components/ui";
import { cls, toFa } from "../lib/utils";

export default function Explore() {
  const { shortVideos, incrementShortVideoEngagement } = useApp();
  const [category, setCategory] = useState("همه");
  const [liked, setLiked] = useState<string[]>([]);
  const [muted, setMuted] = useState(true);
  const categories = ["همه", ...Array.from(new Set(shortVideos.map((v) => v.category)))];
  const visible = useMemo(
    () =>
      shortVideos.filter(
        (v) => v.status === "published" && (category === "همه" || v.category === category)
      ),
    [shortVideos, category]
  );

  if (!visible.length) {
    return (
      <div className="container-x py-14">
        <EmptyState
          icon={<PlaySquare size={26} />}
          title="هنوز ویدئویی منتشر نشده"
          text="مدیر می‌تواند از پنل مدیریت ویدئوی کوتاه جدید اضافه کند."
        />
      </div>
    );
  }

  return (
    <div className="bg-base">
      <div className="container-x py-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip mb-2 border border-neon/25 bg-neon/10 text-sky">
              <Sparkles size={13} /> اکسپلور AI
            </span>
            <h1 className="text-2xl font-black sm:text-3xl">ویدئوهای کوتاه هوش مصنوعی</h1>
            <p className="mt-2 text-sm text-muted">
              اسکرول کن، ایده بگیر و مهارت بعدی‌ات را پیدا کن.
            </p>
          </div>
          <Link to="/prompt-trends" className="btn-secondary btn-md">
            ترند پرامپت‌ها <Sparkles size={15} />
          </Link>
        </div>
        <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
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

        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-start">
          <div className="no-scrollbar flex snap-y snap-mandatory flex-col gap-4 overflow-y-auto rounded-2xl bg-navy/35 p-2 lg:max-h-[calc(100vh-245px)]">
            {visible.map((video, index) => (
              <ShortCard
                key={video.id}
                video={video}
                index={index}
                muted={muted}
                liked={liked.includes(video.id)}
                onViewed={() => incrementShortVideoEngagement(video.id, "view")}
                onLike={() => {
                  if (!liked.includes(video.id)) {
                    setLiked((s) => [...s, video.id]);
                    incrementShortVideoEngagement(video.id, "like");
                  }
                }}
                onMute={() => setMuted((v) => !v)}
              />
            ))}
          </div>
          <aside className="hidden space-y-4 lg:block">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <PlaySquare size={18} className="text-neon" /> راهنمای اکسپلور
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-muted">
                <li>• برای رفتن به ویدئوی بعدی اسکرول کن.</li>
                <li>• ویدئوها از پنل مدیریت قابل انتشار، آرشیو و ویرایش هستند.</li>
                <li>• برای ایده‌های قابل کپی، بخش ترند پرامپت‌ها را ببین.</li>
              </ul>
            </div>
            <div className="card border-neon/20 bg-neon/5 p-5">
              <p className="text-xs font-bold text-sky">کتابخانه زنده</p>
              <p className="mt-2 text-2xl font-black">{toFa(visible.length)}</p>
              <p className="mt-1 text-xs text-muted">ویدئوی منتشرشده در این دسته</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ShortCard({
  video,
  index,
  muted,
  liked,
  onViewed,
  onLike,
  onMute,
}: {
  video: ReturnType<typeof useApp>["shortVideos"][number];
  index: number;
  muted: boolean;
  liked: boolean;
  onViewed: () => void;
  onLike: () => void;
  onMute: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const viewed = useRef(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !viewed.current) {
          viewed.current = true;
          onViewed();
        }
      },
      { threshold: 0.7 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onViewed]);
  return (
    <article
      ref={ref}
      className="relative min-h-[560px] snap-start overflow-hidden rounded-xl border border-line/60 bg-black shadow-card sm:min-h-[620px]"
    >
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-80"
        src={video.videoUrl}
        poster={video.posterUrl}
        muted={muted}
        controls={playing}
        playsInline
        onPlay={() => setPlaying(true)}
        onClick={(e) => {
          const el = e.currentTarget;
          if (el.paused) void el.play();
          else el.pause();
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/15 to-black/20" />
      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span className="chip border border-white/15 bg-black/45 text-white">
          <Play size={12} /> {toFa(index + 1)}
        </span>
        <button
          onClick={onMute}
          className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white"
          aria-label="صدا"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-5 text-white">
        <div className="mb-3 flex items-center gap-2">
          <Avatar name={video.creator} size="sm" online />
          <div>
            <p className="text-sm font-bold">{video.creator}</p>
            <p className="text-[10px] text-white/65">{video.creatorRole}</p>
          </div>
        </div>
        <span className="chip mb-2 border border-sky/35 bg-sky/15 text-sky">{video.category}</span>
        <h2 className="text-lg font-black leading-8">{video.title}</h2>
        <p className="mt-1 text-xs leading-6 text-white/75">{video.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {video.tags.map((t) => (
            <span key={t} className="text-[10px] text-white/60">
              #{t}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-white/70">
            <span className="flex items-center gap-1">
              <Eye size={14} /> {toFa(video.views)}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={14} className={liked ? "fill-danger text-danger" : ""} />{" "}
              {toFa(video.likes)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onLike}
              className={cls(
                "grid h-10 w-10 place-items-center rounded-full border",
                liked
                  ? "border-danger/50 bg-danger/20 text-danger"
                  : "border-white/20 bg-black/30 text-white"
              )}
              aria-label="پسندیدن"
            >
              <Heart size={17} className={liked ? "fill-current" : ""} />
            </button>
            <button
              onClick={() => void navigator.clipboard?.writeText(window.location.href)}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/30 text-white"
              aria-label="اشتراک‌گذاری"
            >
              <Share2 size={17} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
