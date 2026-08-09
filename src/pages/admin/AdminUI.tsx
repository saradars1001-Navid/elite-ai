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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="chip mb-3 border border-warn/25 bg-warn/10 text-warn">پنل مدیریت</span>
        <h1 className="text-2xl font-black">{title}</h1>
        {desc && <p className="mt-1.5 text-sm text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

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
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className={cls("grid h-10 w-10 place-items-center rounded-lg", tone)}>
          <Icon size={19} />
        </span>
        {sub && <span className="text-[11px] text-muted">{sub}</span>}
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead>
            <tr className="border-b border-line/60 bg-surface2/50">
              {head.map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-bold text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

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
    <td className={cls("px-4 py-3.5", className)} colSpan={colSpan} dir={dir}>
      {children}
    </td>
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
