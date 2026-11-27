/** True when either the in-game Reduced Motion toggle or the OS preference is active. */
export function isReducedMotionActive(options?: {
  datasetValue?: string;
  mediaMatches?: boolean;
}): boolean {
  if (options !== undefined) {
    return options.datasetValue === "on" || options.mediaMatches === true;
  }
  if (typeof document !== "undefined" && document.documentElement.dataset.reducedMotion === "on") {
    return true;
  }
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
