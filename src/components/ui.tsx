import React, { useEffect, useRef, useState } from "react";
import { Star, X, Sparkles, CheckCircle2, Trophy } from "lucide-react";
import { cls, toFa } from "../lib/utils";
import { LevelGlyph } from "../lib/entityIcons";
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
  const c = color || "#3B82F6";
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cls("grid place-items-center rounded-full font-bold text-white", sizes[size])}
        style={{ background: `linear-gradient(135deg, ${c}, ${c}99)` }}
      >
        {ini}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-page bg-teal" />
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
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ id: number; startY: number } | null>(null);

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

  // The sheet offset always starts clean.
  useEffect(() => {
    setDragY(0);
    setDragging(false);
    dragRef.current = null;
  }, [open]);

  if (!open) return null;

  // Dragging only makes sense while the dialog is a bottom sheet on phones.
  const isSheet = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

  const onGrabStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSheet()) return;
    dragRef.current = { id: e.pointerId, startY: e.clientY };
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer can already be gone (e.g. a very quick tap); dragging
      // still works through the element's own pointermove events.
    }
  };

  const onGrabMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    setDragY(Math.max(0, e.clientY - d.startY));
  };

  const onGrabEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const dismissed = dragY > 110;
    setDragY(0);
    if (dismissed) onClose();
  };

  const dragged = dragY > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <div
        className={cls("absolute inset-0 bg-black/45", !dragged && "animate-fade-in")}
        style={{
          opacity: dragged ? Math.max(0.12, 1 - dragY / 320) : undefined,
          transition: dragging ? "none" : "opacity .28s ease",
        }}
        onClick={onClose}
      />
      <div
        className={cls(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface shadow-card sm:rounded-xl sm:border sm:border-line",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
          !dragging && "animate-slide-up"
        )}
        style={{
          transform: dragged ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform .28s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* grip + header double as the grab area on phones */}
        <div
          className="touch-none sm:touch-auto"
          onPointerDown={onGrabStart}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabEnd}
          onPointerCancel={onGrabEnd}
        >
          <div className="tg-sheet-grip sm:hidden" />
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
            <h3 className="text-[17px] font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface2"
              aria-label="بستن"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
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
    <div className="rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-neon/10">
          <LevelGlyph level={level.level} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[15px] font-semibold">
              سطح {toFa(level.level)} · {level.title}
            </span>
            <span className="shrink-0 text-[13px] font-medium text-sky">
              {toFa(Math.round(level.progress))}٪
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2 text-[12px] text-muted">
            <span>{toFa(xp)} امتیاز تجربه</span>
            {!compact && level.nextMinXp !== null && (
              <span className="shrink-0">
                {toFa(level.xpIntoLevel)} از {toFa(level.xpNeeded)} تا سطح بعد
              </span>
            )}
          </div>
          <div className="tg-rail">
            <span style={{ width: `${level.progress}%` }} />
          </div>
        </div>
      </div>
      {!compact && level.nextTitle && (
        <p className="mt-2 text-[12px] text-muted">سطح بعدی: {level.nextTitle}</p>
      )}
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
          <Trophy size={16} /> چالش هفتگی
        </h2>
        <span className="text-[11px] text-muted">
          {toFa(done)} از {toFa(challenges.length)} چالش تکمیل‌شده
        </span>
      </div>
      <div className="mb-5 mt-2.5 flex items-center gap-3">
        <Progress
          value={overall}
          className="flex-1"
          color="bg-gradient-to-l from-[#7C3AED] to-neon"
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
    <div className="flex flex-col items-center gap-2.5 rounded-xl bg-surface px-6 py-12 text-center animate-fade-in">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-surface2 text-muted">
        {icon}
      </span>
      <h4 className="text-[15px] font-semibold">{title}</h4>
      {text && <p className="max-w-sm text-[13px] leading-6 text-muted">{text}</p>}
      {action && <div className="mt-1">{action}</div>}
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
    <div className="tg-page-list divide-y divide-line overflow-hidden rounded-xl bg-surface">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-3 w-4/5" />
          </div>
        </div>
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
    <div className="tg-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cls("tg-tab-item", active === t.id && "active")}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cls(
                "ms-1.5 text-[11px] tabular-nums",
                active === t.id ? "text-sky" : "text-locked"
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
        "flex items-start justify-between gap-3 rounded-[10px] border px-3.5 py-3 text-[13px] animate-slide-up",
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
