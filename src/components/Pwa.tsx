import { useEffect, useState } from "react";
import { WifiOff, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Captures the browser's install prompt (only fires when the app is installable). */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return { canInstall: !!deferred, promptInstall };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/**
 * Small fixed toast shown only while offline. It never shifts the layout
 * and sits above the mobile bottom nav.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      className="fixed bottom-20 left-4 z-[70] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-warn/40 bg-surface/95 px-3.5 py-2.5 text-xs font-bold text-warn shadow-card backdrop-blur animate-slide-up lg:bottom-6"
      role="status"
    >
      <WifiOff size={14} className="shrink-0" />
      حالت آفلاین — درسنامه‌ها و محتوای ذخیره‌شده همچنان در دسترس‌اند
    </div>
  );
}

/** Install button — only appears when the browser offers the PWA install prompt. */
export function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  if (!canInstall) return null;
  return (
    <>
      <button
        onClick={promptInstall}
        className="btn-secondary btn-md hidden sm:inline-flex"
        aria-label="نصب اپلیکیشن"
      >
        <Download size={15} /> نصب اپ
      </button>
      <button
        onClick={promptInstall}
        className="btn-ghost btn-md !px-2.5 sm:hidden"
        aria-label="نصب اپلیکیشن"
      >
        <Download size={18} />
      </button>
    </>
  );
}
