const TV_MODE = import.meta.env.VITE_TV_MODE === "true";

if (TV_MODE && typeof window !== "undefined") {
  document.documentElement.classList.add("dv-tv-mode");

  const SELECTABLE = [
    "button:not(:disabled)",
    "a[href]",
    "input:not(:disabled)",
    "select:not(:disabled)",
    "textarea:not(:disabled)",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity) !== 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      element.getAttribute("aria-hidden") !== "true";
  };

  const getCandidates = () =>
    [...document.querySelectorAll(SELECTABLE)].filter(isVisible);

  const center = (rect) => ({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  });

  const moveFocus = (direction) => {
    const candidates = getCandidates();
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !candidates.includes(active)) {
      (candidates.find((item) => item.matches(".dv-side-link.active")) ||
        candidates.find((item) => item.matches(".dv-card-image-button")) ||
        candidates[0])?.focus({ preventScroll: true });
      return;
    }

    const currentRect = active.getBoundingClientRect();
    const current = center(currentRect);
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "right" || direction === "down" ? 1 : -1;

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      if (candidate === active) continue;
      const point = center(candidate.getBoundingClientRect());
      const primary = horizontal ? (point.x - current.x) * sign : (point.y - current.y) * sign;
      if (primary <= 2) continue;

      const secondary = horizontal ? Math.abs(point.y - current.y) : Math.abs(point.x - current.x);
      const score = primary + secondary * 1.65;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best) {
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  };

  document.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;

    const active = document.activeElement;
    const isTyping = active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      active instanceof HTMLVideoElement;
    if (isTyping) return;

    event.preventDefault();
    moveFocus(event.key.replace("Arrow", "").toLowerCase());
  }, true);

  window.addEventListener("load", () => {
    window.setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) {
        moveFocus("right");
      }
    }, 500);
  });
}
