export function toFa(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function price(n: number): string {
  return toFa(n.toLocaleString("en-US").replace(/,/g, "٬")) + " تومان";
}

export function priceShort(n: number): string {
  if (n >= 1000000) return toFa(Math.round(n / 1000000)) + " میلیون";
  if (n >= 1000) return toFa(Math.round(n / 1000)) + " هزار";
  return toFa(n);
}

export function minutes(n: number): string {
  return toFa(n) + " دقیقه";
}

export function hours(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return minutes(m);
  return `${toFa(h)} ساعت و ${toFa(m)} دقیقه`;
}

export function percent(n: number): string {
  return toFa(Math.round(n)) + "٪";
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "لحظاتی پیش";
  if (mins < 60) return toFa(mins) + " دقیقه پیش";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return toFa(hrs) + " ساعت پیش";
  const days = Math.floor(hrs / 24);
  if (days < 30) return toFa(days) + " روز پیش";
  const months = Math.floor(days / 30);
  return toFa(months) + " ماه پیش";
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function discountPercent(oldP: number, newP: number): number {
  return Math.round(((oldP - newP) / oldP) * 100);
}

export function validateIranPhone(phone: string): boolean {
  return /^09\d{9}$/.test(phone.replace(/[\s-]/g, ""));
}

export const AVATAR_COLORS = [
  "#3B82F6",
  "#20D6B5",
  "#7C3AED",
  "#F59E0B",
  "#EF4444",
  "#57B8FF",
  "#10B981",
  "#EC4899",
];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "؟") + (parts[1]?.[0] ?? "");
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
