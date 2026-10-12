import React, { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Wand2,
  PlaySquare,
  TrendingUp,
  Calculator,
  Download,
  MoreVertical,
  Moon,
} from "lucide-react";
import { Logo, Avatar } from "./ui";
import { InstallButton, useInstallPrompt } from "./Pwa";
import GlobalSearch from "./GlobalSearch";
import { useApp } from "../lib/store";
import { cls, toFa } from "../lib/utils";
import { useTheme, toggleTheme } from "../lib/theme";
import { LevelGlyph } from "../lib/entityIcons";

/* ────────────────────────── Page transition ───────────────────────────── */

/** Re-keyed on pathname, so every navigation plays a short, quiet enter. */
function PageOutlet() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="animate-page-in">
      <Outlet />
    </div>
  );
}

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

/* Screen titles for the phone title bar. Telegram puts the screen name in the
   bar itself, so the bar — not the page body — names the screen. */
const SCREEN_TITLES: Record<string, string> = {
  "/": "آکادمی ایلیت",
  "/auth": "ورود / ثبت‌نام",
  "/chapters": "فصل‌های آموزشی",
  "/quiz": "کوییز هوش مصنوعی",
  "/quiz/live": "مسابقه زنده",
  "/community": "کامیونیتی",
  "/tools": "ابزارهای هوش مصنوعی",
  "/prompt-lab": "پرامپت‌لب",
  "/explore": "اکسپلور ویدئو",
  "/prompt-trends": "ترند پرامپت‌ها",
  "/notifications": "اعلان‌ها",
  "/profile": "پروفایل",
  "/dashboard": "داشبورد",
  "/ui-kit": "کیت رابط کاربری",
};

function screenTitle(pathname: string): string {
  const exact = SCREEN_TITLES[pathname];
  if (exact) return exact;
  // deepest matching prefix wins, so /chapters/lesson keeps "فصل‌های آموزشی"
  const prefix = Object.keys(SCREEN_TITLES)
    .filter((k) => k !== "/" && pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? SCREEN_TITLES[prefix] : SCREEN_TITLES["/"];
}

/* ──────────────────────────── Night mode ───────────────────────────────── */

/** The switch itself — reads and writes the persisted light/dark choice. */
function NightSwitch({ className }: { className?: string } = {}) {
  const dark = useTheme() === "dark";
  return (
    <span className={cls("switch shrink-0", className)}>
      <input type="checkbox" checked={dark} onChange={() => toggleTheme()} aria-label="حالت شب" />
      <span className="track">
        <span className="thumb" />
      </span>
    </span>
  );
}

/** Desktop header: a moon beside the switch, in the header action cluster. */
function NightModeToggle() {
  const dark = useTheme() === "dark";
  return (
    <label className="flex cursor-pointer items-center gap-1.5" title="حالت شب">
      <Moon size={17} className={cls("transition-colors", dark ? "text-sky" : "text-muted")} />
      <NightSwitch />
    </label>
  );
}

/** Phone action sheets: the full Telegram settings row. */
function NightRow() {
  const dark = useTheme() === "dark";
  return (
    <label className="tg-row cursor-pointer">
      <span className={cls("tg-row-icon", dark && "text-sky")}>
        <Moon size={18} />
      </span>
      <span className="tg-row-body">
        <span className="tg-row-title">حالت شب</span>
      </span>
      <NightSwitch />
    </label>
  );
}

/** Dashboard / admin sidebars: a compact row above the footer actions. */
function NightModeRow({ className }: { className?: string }) {
  const dark = useTheme() === "dark";
  return (
    <label
      className={cls(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-text",
        className
      )}
    >
      <Moon size={17} className={cls(dark && "text-sky")} /> حالت شب
      <NightSwitch className="ms-auto" />
    </label>
  );
}

/** Shared Telegram-style scroll-collapse for phone title bars: past 56px,
    scrolling down hides the bar; any upward scroll brings it right back. */
function useTitleBarCollapse() {
  const [barCollapsed, setBarCollapsed] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setBarCollapsed(y > 56 && y > lastY);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return barCollapsed;
}

export function SiteHeader() {
  const { user, unreadCount, logout, level } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [userMenu, setUserMenu] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const barCollapsed = useTitleBarCollapse();

  // the phone actions sheet never survives a navigation
  useEffect(() => setActionsOpen(false), [pathname]);

  const title = screenTitle(pathname);

  return (
    <header
      className={cls(
        "tg-header",
        // collapsed: no hairline — phones only, the desktop header keeps its line
        barCollapsed && !actionsOpen && "max-lg:border-b-0"
      )}
    >
      {/* phones: a Telegram-style title bar — the screen name, collapsing on
          scroll like Telegram does. Desktop hides the whole row. */}
      <div
        className={cls(
          "relative z-40 flex h-14 shrink-0 items-center gap-2 px-4 transition-all duration-200 ease-out lg:hidden",
          barCollapsed && !actionsOpen ? "mb-[-3.5rem] h-0 overflow-hidden opacity-0" : ""
        )}
      >
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-7 text-text">
          {title}
        </h1>

        {/* phones: a single actions icon, the way Telegram keeps the bar clean */}
        <button
          onClick={() => setActionsOpen((v) => !v)}
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-text transition-colors active:bg-surface2"
          aria-label="دسترسی‌های بیشتر"
          aria-expanded={actionsOpen}
        >
          {actionsOpen ? <X size={20} /> : <MoreVertical size={20} />}
          {unreadCount > 0 && !actionsOpen && (
            <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" aria-hidden />
          )}
        </button>
      </div>

      {/* desktop: the full brand + nav + actions row */}
      <div className="container-x hidden h-14 items-center gap-2 lg:flex">
        {/* desktop: brand */}
        <Link to="/" aria-label="صفحه اصلی" className="shrink-0">
          <Logo size="sm" />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="منوی اصلی">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cls(
                  "rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-surface2 text-text"
                    : "text-muted hover:bg-surface2 hover:text-text"
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
                "relative grid h-9 w-9 place-items-center rounded-lg transition-colors",
                isActive ? "bg-surface2 text-text" : "text-muted hover:bg-surface2 hover:text-text"
              )
            }
            aria-label="اعلانات"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute end-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white">
                {toFa(unreadCount)}
              </span>
            )}
          </NavLink>
        </nav>

        {/* desktop action cluster — hidden on phones, where one icon does it all */}
        <div className="ms-auto hidden items-center gap-0.5 lg:flex">
          <GlobalSearch />
          <InstallButton />

          {user?.role === "admin" && (
            <Link
              to="/admin"
              className="rounded-lg p-2 text-warn transition-colors hover:bg-warn/10"
              aria-label="پنل مدیریت"
            >
              <Settings size={19} />
            </Link>
          )}

          <NightModeToggle />

          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-line/60 bg-surface py-1.5 pr-1.5 pl-3 transition-colors hover:border-neon/40"
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
                      <LevelGlyph level={level.level} size={13} /> سطح {toFa(level.level)} ·{" "}
                      {level.title}
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

      {/* phones: the actions sheet hanging off the bar, like a Telegram menu */}
      {actionsOpen && (
        <>
          <button
            className="fixed inset-0 top-14 z-30 cursor-default lg:hidden"
            onClick={() => setActionsOpen(false)}
            aria-label="بستن دسترسی‌ها"
          />
          <div className="tg-group absolute inset-x-3 top-full z-40 mx-0 mt-2 max-h-[70vh] overflow-y-auto shadow-float lg:hidden">
            <GlobalSearch variant="row" />
            <Link to="/notifications" className="tg-row">
              <span className="tg-row-icon">
                <Bell size={18} />
              </span>
              <span className="tg-row-body">
                <span className="tg-row-title">اعلان‌ها</span>
              </span>
              {unreadCount > 0 && <span className="tg-badge">{toFa(unreadCount)}</span>}
            </Link>
            <NightRow />
            {user && (
              <>
                <Link to="/profile" className="tg-row">
                  <span className="tg-row-icon">
                    <UserCircle2 size={18} />
                  </span>
                  <span className="tg-row-body">
                    <span className="tg-row-title">پروفایل</span>
                  </span>
                </Link>
                <Link to="/dashboard" className="tg-row">
                  <span className="tg-row-icon">
                    <LayoutDashboard size={18} />
                  </span>
                  <span className="tg-row-body">
                    <span className="tg-row-title">داشبورد</span>
                  </span>
                </Link>
                {user.role === "admin" && (
                  <Link to="/admin" className="tg-row">
                    <span className="tg-row-icon">
                      <Settings size={18} />
                    </span>
                    <span className="tg-row-body">
                      <span className="tg-row-title">پنل مدیریت</span>
                    </span>
                  </Link>
                )}
              </>
            )}
            {canInstall && (
              <button onClick={promptInstall} className="tg-row">
                <span className="tg-row-icon">
                  <Download size={18} />
                </span>
                <span className="tg-row-body">
                  <span className="tg-row-title">نصب اپلیکیشن</span>
                </span>
              </button>
            )}
            {user ? (
              <button
                onClick={() => {
                  setActionsOpen(false);
                  logout();
                  navigate("/");
                }}
                className="tg-row"
              >
                <span className="tg-row-icon">
                  <LogOut size={18} className="text-danger" />
                </span>
                <span className="tg-row-body">
                  <span className="tg-row-title text-danger">خروج از حساب</span>
                </span>
              </button>
            ) : (
              <Link to="/auth" className="tg-row">
                <span className="tg-row-icon">
                  <UserCircle2 size={18} />
                </span>
                <span className="tg-row-body">
                  <span className="tg-row-title">ورود / ثبت‌نام</span>
                </span>
              </Link>
            )}
          </div>
        </>
      )}
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
    { to: "/", label: "خانه", icon: Home, end: true },
    { to: "/chapters", label: "یادگیری", icon: BookOpen },
    { to: "/quiz", label: "کوییز", icon: Gamepad2 },
    { to: "/community", label: "کامیونیتی", icon: Users },
    { to: "/profile", label: "پروفایل", icon: UserCircle2 },
  ];
  return (
    <nav className="tg-tabbar lg:hidden" aria-label="ناوبری پایین">
      <div className="tg-tabbar-inner grid-cols-5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => cls("tg-tab", isActive && "active")}
          >
            {({ isActive }) => (
              <>
                <span className="tg-tab-icon">
                  <it.icon size={21} strokeWidth={isActive ? 2.3 : 1.8} />
                </span>
                <span className="tg-tab-label">{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/* ─────────────────────────────── Footer ────────────────────────────────── */

export function Footer() {
  return (
    <footer className="mt-14 hidden border-t border-line bg-surface lg:block">
      <div className="container-x grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="border-t border-line py-5 text-center text-xs text-locked">
        © ۱۴۰۴ آکادمی ایلیت — تمامی حقوق محفوظ است.
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
      <main className="flex-1 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <PageOutlet />
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
  const { user, logout, unreadCount } = useApp();
  const navigate = useNavigate();
  const [dashActions, setDashActions] = useState(false);
  const barCollapsed = useTitleBarCollapse();
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
          <NightModeRow className="mb-1.5" />
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
        {/* phones: the same Telegram title bar as the rest of the app */}
        <div
          className={cls(
            "tg-header sticky top-0 z-40 lg:hidden",
            barCollapsed && !dashActions && "mb-[-3.5rem] h-0 overflow-hidden opacity-0 border-b-0" // collapsed: no hairline
          )}
        >
          <div className="flex h-14 items-center gap-2 px-4">
            <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-7 text-text">
              داشبورد
            </h1>
            <button
              onClick={() => setDashActions((v) => !v)}
              className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-text transition-colors active:bg-surface2"
              aria-label="دسترسی‌های بیشتر"
              aria-expanded={dashActions}
            >
              {dashActions ? <X size={20} /> : <MoreVertical size={20} />}
              {unreadCount > 0 && !dashActions && (
                <span
                  className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-danger"
                  aria-hidden
                />
              )}
            </button>
          </div>
          {dashActions && (
            <div className="tg-group absolute inset-x-3 top-full z-40 mx-0 mt-2 max-h-[70vh] overflow-y-auto shadow-float">
              {DASH_NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setDashActions(false)}
                  className="tg-row"
                >
                  <span className="tg-row-icon">
                    <n.icon size={18} />
                  </span>
                  <span className="tg-row-body">
                    <span className="tg-row-title">{n.label}</span>
                  </span>
                </NavLink>
              ))}
              {user?.role === "admin" && (
                <NavLink to="/admin" onClick={() => setDashActions(false)} className="tg-row">
                  <span className="tg-row-icon bg-warn/10 text-warn">
                    <Settings size={18} />
                  </span>
                  <span className="tg-row-body">
                    <span className="tg-row-title">پنل مدیریت</span>
                  </span>
                </NavLink>
              )}
              <NightRow />
              <button
                onClick={() => {
                  setDashActions(false);
                  logout();
                  navigate("/");
                }}
                className="tg-row"
              >
                <span className="tg-row-icon">
                  <LogOut size={18} className="text-danger" />
                </span>
                <span className="tg-row-body">
                  <span className="tg-row-title text-danger">خروج از حساب</span>
                </span>
              </button>
            </div>
          )}
        </div>
        <main className="px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:py-10 lg:pb-10">
          <PageOutlet />
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
  const { pathname } = useLocation();
  const barCollapsed = useTitleBarCollapse();
  if (!user || user.role !== "admin") return null;

  const nav = [
    { to: "/admin", label: "داشبورد", icon: LayoutDashboard, end: true },
    { to: "/admin/chapters", label: "فصل‌ها و درس‌ها", icon: BookOpen },
    { to: "/admin/users", label: "کاربران", icon: Users },
    { to: "/admin/exams", label: "آزمون‌ها و تخفیف‌ها", icon: Gamepad2 },
    { to: "/admin/pricing", label: "پیش‌نمایش قیمت", icon: Calculator },
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

  // the phone title bar names the current admin screen
  const section =
    nav.find((n) => n.to === pathname)?.label ??
    nav
      .filter((n) => n.to !== "/admin" && pathname.startsWith(`${n.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0]?.label ??
    "پنل مدیریت";

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
          <NightModeRow className="mb-1.5" />
          <Link
            to="/dashboard"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface2 hover:text-text"
          >
            <Home size={16} /> بازگشت به سایت
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* phones: the same Telegram title bar as the rest of the app */}
        <div
          className={cls(
            "tg-header sticky top-0 z-40 lg:hidden",
            barCollapsed && !open && "mb-[-3.5rem] h-0 overflow-hidden opacity-0 border-b-0" // collapsed: no hairline
          )}
        >
          <div className="flex h-14 items-center gap-2 px-4">
            <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-7 text-text">
              {section}
            </h1>
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-text transition-colors active:bg-surface2"
              aria-label="منوی مدیریت"
              aria-expanded={open}
            >
              {open ? <X size={20} /> : <MoreVertical size={20} />}
            </button>
          </div>
          {open && (
            <div className="tg-group absolute inset-x-3 top-full z-40 mx-0 mt-2 max-h-[70vh] overflow-y-auto shadow-float">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => cls("tg-row", isActive && "font-semibold")}
                >
                  <span className={cls("tg-row-icon", "bg-warn/10 text-warn")}>
                    <n.icon size={18} />
                  </span>
                  <span className="tg-row-body">
                    <span className="tg-row-title">{n.label}</span>
                  </span>
                </NavLink>
              ))}
              <NightRow />
              <Link to="/dashboard" onClick={() => setOpen(false)} className="tg-row">
                <span className="tg-row-icon">
                  <Home size={18} />
                </span>
                <span className="tg-row-body">
                  <span className="tg-row-title">بازگشت به اپ</span>
                </span>
              </Link>
            </div>
          )}
        </div>
        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <PageOutlet />
        </main>
      </div>
    </div>
  );
}
