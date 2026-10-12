import React from "react";
import { cls, toFa } from "../../lib/utils";

export function AdminHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {/* phones get the screen name from the title bar, like the rest of the app */}
        <div className="max-lg:hidden">
          <span className="chip mb-3 border border-warn/25 bg-warn/10 text-warn">پنل مدیریت</span>
          <h1 className="text-2xl font-black">{title}</h1>
        </div>
        {desc && <p className="mt-1.5 text-sm text-muted max-lg:mt-0">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

/* Data tables and stat cards use the same Telegram grouped-row lists as the
   rest of the app: a rounded surface group with hairline dividers between
   rows, the value sitting at the end of the row. */

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "text-sky bg-sky/10",
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: string;
  sub?: string;
}) {
  return (
    <div className="tg-row min-h-[64px]">
      <span className={cls("tg-row-icon", tone)}>
        <Icon size={19} />
      </span>
      <span className="tg-row-body">
        <span className="tg-row-title">{label}</span>
        {sub && <span className="tg-row-sub">{sub}</span>}
      </span>
      <span className="shrink-0 text-xl font-black text-text">{value}</span>
    </div>
  );
}

/** Grouped-row replacement for the old data table. The column captions live
    in a quiet label only on desktop — Telegram lists don't need headers. */
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <>
      {head.length > 0 && <p className="tg-group-title !hidden lg:!block">{head.join(" · ")}</p>}
      <div className="tg-group overflow-hidden">{children}</div>
    </>
  );
}

/** One data row inside the group (was a table <tr>). Cells wrap naturally:
    on wide screens they share the line, on phones the row flows to two. */
export function TRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cls(
        "relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-right transition-colors",
        onClick && "cursor-pointer hover:bg-surface2/40",
        className
      )}
    >
      {children}
    </div>
  );
}

/** One cell of a TRow (was a table <td>). colSpan renders full-width. */
export function Td({
  children,
  className,
  colSpan,
  dir,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
  dir?: string;
}) {
  return (
    <div
      className={cls(
        "flex min-w-0 flex-1 flex-wrap items-center gap-2",
        colSpan ? "w-full flex-[1_1_100%]" : "",
        className
      )}
      dir={dir}
    >
      {children}
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cls(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        on ? "bg-teal" : "bg-line"
      )}
    >
      <span
        className={cls(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          on ? "right-[22px]" : "right-0.5"
        )}
      />
    </button>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warn" | "info";
}) {
  const styles = {
    default: "border border-line bg-surface2 text-muted",
    success: "border border-teal/25 bg-teal/10 text-teal",
    danger: "border border-danger/25 bg-danger/10 text-danger",
    warn: "border border-warn/25 bg-warn/10 text-warn",
    info: "border border-sky/25 bg-sky/10 text-sky",
  }[tone];
  return <span className={cls("chip", styles)}>{children}</span>;
}

export function faNum(n: number): string {
  return toFa(n.toLocaleString());
}
