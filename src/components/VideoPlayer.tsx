import React, { useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Gauge,
  Maximize,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { cls, toFa } from "../lib/utils";
import { DEMO_LESSON_VIDEO_URL } from "../lib/data";

export default function VideoPlayer({
  title,
  captions,
  locked,
  src,
}: {
  title: string;
  captions?: string[];
  locked: boolean;
  /** Real short-lived signed URL (Supabase) — falls back to the demo clip. */
  src?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [showSpeed, setShowSpeed] = useState(false);
  const [captionIdx, setCaptionIdx] = useState(-1);

  if (locked) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-navy">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-neon/30 bg-neon/10 text-neon shadow-glow-sm">
              <ShieldCheck size={28} />
            </span>
            <h4 className="font-bold">محتوای این درس محافظت‌شده است</h4>
            <p className="max-w-sm text-sm leading-7 text-muted">
              برای تماشای این ویدئو و استفاده از تمام امکانات فصل، ابتدا دسترسی این فصل را خریداری
              کنید. محتوای پولی فقط برای کاربران دارای دسترسی نمایش داده می‌شود.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${toFa(m)}:${toFa(String(sec).padStart(2, "0"))}`;
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const seek = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  };

  const setRate = (r: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = r;
    setSpeed(r);
    setShowSpeed(false);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-black shadow-card">
      <div className="relative aspect-video w-full">
        <video
          ref={videoRef}
          src={src ?? DEMO_LESSON_VIDEO_URL}
          poster=""
          className="h-full w-full"
          controls={false}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setCurrent(v.currentTime);
            if (v.duration) setProgress((v.currentTime / v.duration) * 100);
            if (captions?.length) {
              const idx = Math.min(
                Math.floor((v.currentTime / v.duration) * captions.length),
                captions.length - 1
              );
              setCaptionIdx(idx);
            }
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onContextMenu={(e) => e.preventDefault()}
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          crossOrigin="anonymous"
        />
        {/* click overlay */}
        <button
          onClick={toggle}
          className="absolute inset-0 grid place-items-center bg-black/20"
          aria-label={playing ? "توقف" : "پخش"}
        >
          {!playing && (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-neon/90 text-white shadow-glow transition-transform hover:scale-105">
              <Play size={26} className="mr-1" fill="currentColor" />
            </span>
          )}
        </button>

        {/* caption */}
        {playing && captionIdx >= 0 && captions?.[captionIdx] && (
          <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
            <span className="rounded-md bg-black/80 px-3 py-1.5 text-xs text-white animate-fade-in">
              {captions[captionIdx]}
            </span>
          </div>
        )}

        {/* top badges */}
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-[10px] text-muted">
          <ShieldCheck size={12} className="text-teal" />
          دانلود غیرفعال — محافظت محتوا
        </div>

        {/* controls */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-10">
          <input
            type="range"
            min={0}
            max={1000}
            value={progress * 10}
            onChange={(e) => {
              const v = videoRef.current;
              if (v && duration) {
                v.currentTime = (Number(e.target.value) / 10000) * duration;
              }
            }}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-[#2F8CFF]"
            aria-label="نوار پیشرفت ویدئو"
            dir="ltr"
          />
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggle}
                className="rounded-md p-2 text-white hover:bg-white/10"
                aria-label="پخش/توقف"
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={() => seek(-10)}
                className="rounded-md p-2 text-white hover:bg-white/10"
                aria-label="عقب ۱۰ ثانیه"
              >
                <RotateCcw size={17} />
              </button>
              <button
                onClick={() => seek(10)}
                className="rounded-md p-2 text-white hover:bg-white/10"
                aria-label="جلو ۱۰ ثانیه"
              >
                <RotateCw size={17} />
              </button>
              <button
                onClick={() => {
                  videoRef.current!.muted = !muted;
                  setMuted(!muted);
                }}
                className="rounded-md p-2 text-white hover:bg-white/10"
                aria-label="صدا"
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <span className="hidden text-xs text-white/80 sm:block" dir="ltr">
                {fmt(current)} / {fmt(duration)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <button
                  onClick={() => setShowSpeed((v) => !v)}
                  className="flex items-center gap-1 rounded-md p-2 text-xs text-white hover:bg-white/10"
                  aria-label="سرعت پخش"
                >
                  <Gauge size={16} />
                  <span className="font-bold">{toFa(speed)}×</span>
                </button>
                {showSpeed && (
                  <div className="absolute bottom-full right-0 mb-1 overflow-hidden rounded-md border border-line bg-surface shadow-card animate-fade-in">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRate(r)}
                        className={cls(
                          "block w-full px-4 py-1.5 text-xs transition-colors hover:bg-surface2",
                          speed === r ? "bg-neon/15 text-sky" : "text-muted"
                        )}
                      >
                        {toFa(r)}×
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => videoRef.current?.requestFullscreen()}
                className="rounded-md p-2 text-white hover:bg-white/10"
                aria-label="تمام‌صفحه"
              >
                <Maximize size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line/60 bg-surface px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Clock size={14} className="text-sky" />
          <span>
            {title} — در نسخه تولید، ویدئو از طریق لینک امن و زمان‌دار ({toFa(45)} دقیقه) سرو می‌شود
            و آدرس مستقیم فایل در سمت کاربر در دسترس نیست. در این نسخه نمایشی، دانلود از مرورگر
            غیرفعال است.
          </span>
        </div>
      </div>
    </div>
  );
}
