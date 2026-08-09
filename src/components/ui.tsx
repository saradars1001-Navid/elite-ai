import React, { useEffect } from "react";
import { Star, X, Sparkles, CheckCircle2 } from "lucide-react";
import { cls, toFa } from "../lib/utils";
import type { LevelInfo, WeeklyChallengeDef } from "../lib/data";

/* ─────────────────────────────── Logo ──────────────────────────────────── */

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const t = size === "lg" ? "text-xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <span className="flex items-center gap-2.5 select-none">
      <span
        className={cls(
          "grid place-items-center rounded-lg bg-gradient-to-br from-neon to-sky text-white shadow-glow-sm",
          s
        )}
      >
        <Sparkles size={size === "lg" ? 22 : size === "sm" ? 15 : 18} />
      </span>
      <span className={cls("font-extrabold leading-none tracking-tight", t)}>
        <span className="text-text">Elite</span>
        <span className="text-neon"> AI</span>
        <span className="block text-[0.6em] font-medium text-muted mt-1">آکادمی ایلیت</span>
      </span>
    </span>
  );
}

/* ────────────────────────────── Avatar ─────────────────────────────────── */

export function Avatar({
  name,
  size = "md",
  color,
  online,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  color?: string;
  online?: boolean;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  const parts = name.trim().split(/\s+/);
  const ini = (parts[0]?.[0] ?? "؟") + (parts[1]?.[0] ?? "");
  const c = color || "#2F8CFF";
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cls("grid place-items-center rounded-full font-bold text-white", sizes[size])}
        style={{ background: `linear-gradient(135deg, ${c}, ${c}99)` }}
      >
        {ini}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-base bg-teal" />
      )}
    </span>
  );
}

/* ──────────────────────────── Progress bar ─────────────────────────────── */

export function Progress({
  value,
  className,
  color = "bg-neon",
}: {
  value: number;
  className?: string;
  color?: string;
}) {
  return (
    <div className={cls("h-2 w-full overflow-hidden rounded-full bg-surface2", className)}>
      <div
        className={cls("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ─────────────────────────────── Stars ─────────────────────────────────── */

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? "fill-warn text-warn" : "text-line"}
        />
      ))}
    </span>
  );
}

/* ─────────────────────────────── Modal ─────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cls(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-line bg-surface shadow-card animate-slide-up",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line/60 bg-surface/95 px-5 py-4 backdrop-blur">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm !px-2" aria-label="بستن">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Level card ──────────────────────────────── */

export function LevelCard({
  xp,
  level,
  compact,
}: {
  xp: number;
  level: LevelInfo;
  compact?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-neon/25 bg-gradient-to-bl from-navy via-surface to-surface p-5">
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-neon/10 blur-3xl" />
      <div className="absolute -bottom-12 -right-8 h-28 w-28 rounded-full bg-teal/10 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-neon/30 bg-neon/10 text-3xl shadow-glow-sm">
          {level.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border border-neon/25 bg-neon/10 text-sky">
              سطح {toFa(level.level)}
            </span>
            <span className="text-sm font-black">{level.title}</span>
            {level.nextTitle && !compact && (
              <span className="text-[11px] text-locked">بعدی: {level.nextTitle}</span>
            )}
          </div>
          {!compact && (
            <>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
                <span>{toFa(xp)} XP تجربه</span>
                {level.nextMinXp !== null && (
                  <span>
                    {toFa(level.xpIntoLevel)} از {toFa(level.xpNeeded)} تا سطح بعد
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-neon to-teal transition-all duration-700"
                  style={{ width: `${level.progress}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Weekly challenge widget ───────────────────────── */

export function WeeklyChallengeWidget({
  challenges,
  onClaim,
}: {
  challenges: { def: WeeklyChallengeDef; progress: number; claimed: boolean; ready: boolean }[];
  onClaim: (id: string) => void;
}) {
  const done = challenges.filter((c) => c.claimed || c.ready).length;
  const overall = challenges.length ? Math.round((done / challenges.length) * 100) : 0;
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">
          <span className="text-lg">🏆</span> چالش هفتگی
        </h2>
        <span className="text-[11px] text-muted">
          {toFa(done)} از {toFa(challenges.length)} چالش تکمیل‌شده
        </span>
      </div>
      <div className="mb-5 mt-2.5 flex items-center gap-3">
        <Progress
          value={overall}
          className="flex-1"
          color="bg-gradient-to-l from-[#8B5CF6] to-neon"
        />
        <span className="shrink-0 text-xs font-bold text-[#A78BFA]">{toFa(overall)}٪</span>
      </div>
      <div className="space-y-2.5">
        {challenges.map(({ def, progress, claimed, ready }) => (
          <div
            key={def.id}
            className="flex items-center gap-3 rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-3"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy text-lg">
              {def.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{def.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Progress
                  value={(progress / def.target) * 100}
                  className="h-1.5 flex-1"
                  color={claimed || ready ? "bg-teal" : "bg-neon"}
                />
                <span className="shrink-0 text-[10px] text-muted">
                  {toFa(progress)}/{toFa(def.target)} • {toFa(def.rewardXp)} XP
                </span>
              </div>
            </div>
            {claimed ? (
              <span className="chip shrink-0 border border-teal/25 bg-teal/10 text-teal">
                <CheckCircle2 size={13} /> دریافت شد
              </span>
            ) : ready ? (
              <button onClick={() => onClaim(def.id)} className="btn-success btn-sm shrink-0">
                دریافت جایزه
              </button>
            ) : (
              <span className="shrink-0 text-[11px] font-medium text-locked">در جریان</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────────── Empty state ─────────────────────────────── */

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center animate-fade-in">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-surface2 text-neon">
        {icon}
      </span>
      <h4 className="font-bold">{title}</h4>
      {text && <p className="max-w-sm text-sm leading-6 text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ───────────────────────────── Skeletons ───────────────────────────────── */

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cls("card space-y-3 p-5", className)}>
      <div className="skeleton h-6 w-2/3" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-4/5" />
      <div className="flex gap-2 pt-2">
        <div className="skeleton h-8 w-24" />
        <div className="skeleton h-8 w-24" />
      </div>
    </div>
  );
}

export function PageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/* ─────────────────────────────── Tabs ──────────────────────────────────── */

export function Tabs({
  items,
  active,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-line/60 bg-surface p-1">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cls(
            "flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-all",
            active === t.id
              ? "bg-neon/15 text-sky shadow-[inset_0_0_0_1px_rgba(47,140,255,0.4)]"
              : "text-muted hover:text-text"
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cls(
                "chip !px-1.5 !py-0 text-[10px]",
                active === t.id ? "bg-neon/20 text-sky" : "bg-surface2 text-locked"
              )}
            >
              {toFa(t.count)}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── Toast / banner ────────────────────────────── */

export function Banner({
  kind,
  title,
  text,
  onClose,
}: {
  kind: "success" | "error" | "info" | "warn";
  title: string;
  text?: string;
  onClose?: () => void;
}) {
  const styles = {
    success: "border-teal/30 bg-teal/10 text-teal",
    error: "border-danger/30 bg-danger/10 text-danger",
    info: "border-neon/30 bg-neon/10 text-sky",
    warn: "border-warn/30 bg-warn/10 text-warn",
  }[kind];
  return (
    <div
      className={cls(
        "flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm animate-slide-up",
        styles
      )}
      role={kind === "error" ? "alert" : "status"}
    >
      <div>
        <p className="font-bold">{title}</p>
        {text && <p className="mt-0.5 text-xs opacity-90 leading-6">{text}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 opacity-70 hover:opacity-100"
          aria-label="بستن"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
