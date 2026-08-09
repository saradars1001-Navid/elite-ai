import React, { useState } from "react";
import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  Home,
  BookOpen,
  Gamepad2,
  Users,
  UserCircle2,
  LogOut,
  LayoutDashboard,
  Settings,
  ChevronDown,
  Menu,
  X,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  Zap,
  Wrench,
  Wand2,
  PlaySquare,
  TrendingUp,
  Calculator,
} from "lucide-react";
import { Logo, Avatar } from "./ui";
import { InstallButton } from "./Pwa";
import GlobalSearch from "./GlobalSearch";
import { useApp } from "../lib/store";
import { cls, toFa } from "../lib/utils";

/* ─────────────────────────────── Header ────────────────────────────────── */

const NAV = [
  { to: "/chapters", label: "مسیر یادگیری", icon: BookOpen },
  { to: "/tools", label: "ابزارهای هوش مصنوعی", icon: LayoutDashboard },
  { to: "/prompt-lab", label: "پرامپت‌لب", icon: Wand2 },
  { to: "/explore", label: "اکسپلور ویدئو", icon: PlaySquare },
  { to: "/prompt-trends", label: "ترند پرامپت‌ها", icon: TrendingUp },
  { to: "/quiz", label: "کوییز", icon: Gamepad2 },
  { to: "/community", label: "کامیونیتی", icon: Users },
];

export function SiteHeader() {
  const { user, unreadCount, logout, level } = useApp();
  const navigate = useNavigate();
  const [userMenu, setUserMenu] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line/50 bg-base/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Link to="/" aria-label="صفحه اصلی">
          <Logo />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="منوی اصلی">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cls(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-neon/10 text-sky" : "text-muted hover:bg-surface2 hover:text-text"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              cls(
                "relative rounded-md p-2 transition-colors",
                isActive ? "text-sky" : "text-muted hover:bg-surface2 hover:text-text"
              )
            }
            aria-label="اعلانات"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {toFa(unreadCount)}
              </span>
            )}
          </NavLink>
        </nav>

        {/* app-style action cluster */}
        <div className="flex items-center gap-1">
          <GlobalSearch />
          <InstallButton />

          {/* mobile quick links (bottom nav covers the rest) */}
          <Link
            to="/tools"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-text lg:hidden"
            aria-label="بانک ابزارها"
          >
            <Wrench size={19} />
          </Link>
          <Link
            to="/explore"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-text lg:hidden"
            aria-label="اکسپلور ویدئو"
          >
            <PlaySquare size={19} />
          </Link>
          <Link
            to="/notifications"
            className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface2 hover:text-text lg:hidden"
            aria-label="اعلانات"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {toFa(unreadCount)}
              </span>
            )}
          </Link>
          {user?.role === "admin" && (
            <Link
              to="/admin"
              className="rounded-lg p-2 text-warn transition-colors hover:bg-warn/10 lg:hidden"
              aria-label="پنل مدیریت"
            >
              <Settings size={19} />
            </Link>
          )}

          {user ? (
            <div className="relative">
              {/* mobile: avatar jumps straight to profile */}
              <Link
                to="/profile"
                className="rounded-full p-1 transition-transform active:scale-95 lg:hidden"
                aria-label="پروفایل"
              >
                <Avatar name={user.name} size="sm" />
              </Link>

              {/* desktop: dropdown menu */}
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="hidden items-center gap-2 rounded-lg border border-line/60 bg-surface py-1.5 pr-1.5 pl-3 transition-colors hover:border-neon/40 lg:flex"
              >
                <Avatar name={user.name} size="sm" />
                <span className="text-sm font-medium">{user.name}</span>
                <ChevronDown size={14} className="text-muted" />
              </button>
              {userMenu && (
                <div
                  className="absolute left-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-card animate-slide-up"
                  onMouseLeave={() => setUserMenu(false)}
                >
                  <div className="border-b border-line/60 px-4 py-3">
                    <p className="text-sm font-bold">{user.name}</p>
                    <p className="mt-0.5 text-xs text-muted" dir="ltr">
                      {user.phone}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-neon/25 bg-neon/10 px-2 py-0.5 text-[11px] font-bold text-sky">
                      <span>{level.icon}</span> سطح {toFa(level.level)} · {level.title}
                    </p>
                  </div>
                  <MenuItem
                    icon={LayoutDashboard}
                    label="داشبورد"
                    onClick={() => {
                      navigate("/dashboard");
                      setUserMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={UserCircle2}
                    label="پروفایل"
                    onClick={() => {
                      navigate("/profile");
                      setUserMenu(false);
                    }}
                  />
                  {user.role === "admin" && (
                    <MenuItem
                      icon={Settings}
                      label="پنل مدیریت"
                      onClick={() => {
                        navigate("/admin");
                        setUserMenu(false);
                      }}
                    />
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setUserMenu(false);
                      navigate("/");
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
                  >
                    <LogOut size={16} /> خروج از حساب
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/auth" className="btn-primary btn-md">
              ورود / ثبت‌نام
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-text"
    >
      <Icon size={16} /> {label}
    </button>
  );
}

/* ────────────────────────────── Bottom nav ─────────────────────────────── */

export function BottomNav() {
  const items = [
    { to: "/", label: "خانه", icon: Home },
    { to: "/chapters", label: "یادگیری", icon: BookOpen },
    { to: "/quiz", label: "کوییز", icon: Gamepad2 },
    { to: "/community", label: "کامیونیتی", icon: Users },
    { to: "/profile", label: "پروفایل", icon: UserCircle2 },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line/60 bg-surface/95 backdrop-blur-md lg:hidden"
      aria-label="ناوبری پایین"
    >
      <div className="grid grid-cols-5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              cls(
                "flex flex-col items-center gap-1 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[10px] font-medium transition-colors",
                isActive ? "text-neon" : "text-locked"
              )
            }
          >
            <it.icon size={20} />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/* ─────────────────────────────── Footer ────────────────────────────────── */

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line/50 bg-navy/40">
      <div className="container-x grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm leading-7 text-muted">
            آکادمی ایلیت، مسیر تعاملی یادگیری هوش مصنوعی؛ از شناخت ابزارها تا ساخت پروژه‌های واقعی.
          </p>
          <div className="flex gap-2">
            {[Instagram, Linkedin, Twitter, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line/60 bg-surface text-muted transition-all hover:border-neon/50 hover:text-sky"
                aria-label="شبکه اجتماعی"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <FooterCol
          title="آکادمی"
          links={[
            "درباره ما",
            "مسیر یادگیری",
            "بانک ابزارهای هوش مصنوعی",
            "کوییز هوش مصنوعی",
            "کامیونیتی",
          ]}
        />
        <FooterCol
          title="پشتیبانی"
          links={[
            "قوانین و مقررات",
            "حریم خصوصی",
            "سؤالات متداول",
            "تماس با ما",
            "پشتیبانی آنلاین",
          ]}
        />
        <div className="space-y-3 text-sm">
          <h4 className="font-bold text-text">ارتباط با ما</h4>
          <p className="flex items-center gap-2 text-muted">
            <Phone size={15} className="text-neon" />
            <span dir="ltr">۰۲۱-۹۱۰۰۰۰۰۰</span>
          </p>
          <p className="flex items-center gap-2 text-muted">
            <Mail size={15} className="text-neon" />
            support@eliteai.academy
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-line/60 bg-surface px-3 py-2 text-xs text-muted">
              <ShieldCheck size={16} className="text-teal" /> نماد اعتماد الکترونیکی
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line/60 bg-surface px-3 py-2 text-xs text-muted">
              <CreditCard size={16} className="text-sky" /> پرداخت امن زرین‌پال
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-line/50 py-5 text-center text-xs text-locked">
        © ۱۴۰۴ آکادمی ایلیت — تمامی حقوق محفوظ است. نسخه نمایشی
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div className="space-y-3">
      <h4 className="font-bold text-text">{title}</h4>
      <ul className="space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-muted transition-colors hover:text-sky"
            >
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────────────────────── Site layout ─────────────────────────────── */

export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 pb-24 lg:pb-0">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

/* ──────────────────────────── Dashboard layout ─────────────────────────── */

const DASH_NAV = [
  { to: "/dashboard", label: "داشبورد", icon: Home, end: true },
  { to: "/chapters", label: "فصل‌های آموزشی", icon: BookOpen },
  { to: "/quiz", label: "کوییز", icon: Gamepad2 },
  { to: "/community", label: "کامیونیتی", icon: Users },
  { to: "/tools", label: "بانک ابزارها", icon: LayoutDashboard },
  { to: "/explore", label: "اکسپلور ویدئو", icon: PlaySquare },
  { to: "/prompt-trends", label: "ترند پرامپت‌ها", icon: TrendingUp },
  { to: "/notifications", label: "اعلانات", icon: Bell },
  { to: "/profile", label: "پروفایل", icon: UserCircle2 },
];

export function DashboardLayout() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      {/* sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-line/50 bg-navy/50 lg:flex">
        <div className="border-b border-line/50 px-5 py-5">
          <Link to="/">
            <Logo size="sm" />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {DASH_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cls(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-neon/12 text-sky shadow-[inset_0_0_0_1px_rgba(47,140,255,0.35)]"
                    : "text-muted hover:bg-surface2 hover:text-text"
                )
              }
            >
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cls(
                  "mt-4 flex items-center gap-3 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2.5 text-sm font-medium text-warn transition-colors",
                  isActive ? "bg-warn/15" : "hover:bg-warn/10"
                )
              }
            >
              <Settings size={17} /> پنل مدیریت
            </NavLink>
          )}
        </nav>
        <div className="border-t border-line/50 p-3">
          <button
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <LogOut size={16} /> خروج از حساب
          </button>
        </div>
      </aside>

      {/* content */}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-40 border-b border-line/50 bg-base/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between">
            <Link to="/">
              <Logo size="sm" />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/notifications"
                className="relative rounded-lg p-2 text-muted"
                aria-label="اعلانات"
              >
                <Bell size={20} />
              </Link>
              <Link to="/profile">{user && <Avatar name={user.name} size="sm" />}</Link>
            </div>
          </div>
        </div>
        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

/* ───────────────────────────── Admin layout ────────────────────────────── */

export function AdminLayout() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  if (!user || user.role !== "admin") return null;

  const nav = [
    { to: "/admin", label: "داشبورد", icon: LayoutDashboard, end: true },
    { to: "/admin/chapters", label: "فصل‌ها و درس‌ها", icon: BookOpen },
    { to: "/admin/users", label: "کاربران", icon: Users },
    { to: "/admin/exams", label: "آزمون‌ها و تخفیف‌ها", icon: Gamepad2 },
    { to: "/admin/pricing", label: "شبیه‌ساز قیمت", icon: Calculator },
    { to: "/admin/quizzes", label: "کوییزها", icon: Zap },
    { to: "/admin/payments", label: "پرداخت‌ها", icon: CreditCard },
    { to: "/admin/tools", label: "بانک ابزارها", icon: LayoutDashboard },
    { to: "/admin/community", label: "کامیونیتی", icon: Users },
    { to: "/admin/notifications", label: "اعلان‌ها", icon: Bell },
    { to: "/admin/prompt-lab", label: "آزمایشگاه پرامپت", icon: Wand2 },
    { to: "/admin/explore", label: "ویدئوهای کوتاه", icon: PlaySquare },
    { to: "/admin/prompt-trends", label: "ترند پرامپت‌ها", icon: TrendingUp },
    { to: "/admin/settings", label: "تنظیمات", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-line/50 bg-navy/50 lg:flex">
        <div className="border-b border-line/50 px-5 py-5">
          <Link to="/">
            <Logo size="sm" />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cls(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-warn/12 text-warn shadow-[inset_0_0_0_1px_rgba(245,166,35,0.35)]"
                    : "text-muted hover:bg-surface2 hover:text-text"
                )
              }
            >
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line/50 p-3">
          <Link
            to="/dashboard"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-text"
          >
            <Home size={16} /> بازگشت به سایت
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line/50 bg-base/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <button className="btn-secondary btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? <X size={16} /> : <Menu size={16} />} منوی مدیریت
          </button>
        </div>
        {open && (
          <nav className="space-y-1 border-b border-line/50 bg-navy/50 px-4 py-3 lg:hidden">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cls(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                    isActive ? "bg-warn/12 text-warn" : "text-muted"
                  )
                }
              >
                <n.icon size={17} /> {n.label}
              </NavLink>
            ))}
          </nav>
        )}
        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
