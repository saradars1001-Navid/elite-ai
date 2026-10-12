import { useEffect } from "react";

/* ==========================================================================
   Native-feeling touch feedback
   - useGlobalRipple(): one document-level listener gives every tappable row,
     button and tab a Material-style ink ripple that starts where the finger
     landed, and cleans itself up afterwards.
   - usePrefersReducedMotion(): motion is opt-out, never forced.
   ========================================================================== */

/**
 * Anything that should ripple when pressed.
 * We match real interactive elements (`button`, `a`) rather than a list of
 * class names, because the app writes buttons as `btn-primary btn-md` — the
 * bare `.btn` token never appears in the markup, so a `.btn` selector would
 * silently miss every button variant.
 */
const RIPPLE_SELECTOR = "button, a, .tg-row, .tg-tab, .tg-tab-item, [data-ripple]";

export function usePrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useGlobalRipple() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      // primary button / touch / pen only
      if (event.button !== 0) return;

      const node = event.target as HTMLElement | null;
      const host = node?.closest<HTMLElement>(RIPPLE_SELECTOR);
      if (!host) return;
      if (host.hasAttribute("disabled") || host.getAttribute("aria-disabled") === "true") return;

      const rect = host.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;

      // The ink is a circle whose diameter is twice the host's longest side, so
      // it always covers the whole shape wherever the finger lands.
      const size = Math.max(rect.width, rect.height) * 2;
      const ink = document.createElement("span");
      ink.className = "ripple-ink";
      ink.setAttribute("aria-hidden", "true");
      ink.style.width = `${size}px`;
      ink.style.height = `${size}px`;
      ink.style.left = `${event.clientX - rect.left - size / 2}px`;
      ink.style.top = `${event.clientY - rect.top - size / 2}px`;

      const computed = getComputedStyle(host);
      const clipped = computed.overflow === "visible";
      const positioned = computed.position === "static";
      if (positioned) host.style.position = "relative";
      if (clipped) host.style.overflow = "hidden";

      host.appendChild(ink);

      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        ink.remove();
        // Only undo the temporary styles once the last ink has gone.
        if (!host.querySelector(".ripple-ink")) {
          if (positioned) host.style.position = "";
          if (clipped) host.style.overflow = "";
        }
      };

      ink.addEventListener("animationend", release, { once: true });
      // Safety net for interrupted/shadowed animations.
      window.setTimeout(release, 900);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
}
