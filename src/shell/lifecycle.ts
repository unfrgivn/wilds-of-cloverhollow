export type LifecycleContext = {
  documentHidden: boolean;
  paused: boolean;
  areaLoading: boolean;
  contextLost?: boolean;
};

/**
 * Freezes live fixed-timestep ticking and resets elapsed accumulator time while
 * an area is loading, WebGL context is lost, or the tab/iOS app is hidden
 * during unpaused play, without interfering with paused harness stepping.
 */
export function shouldFreezeLiveLoop(ctx: LifecycleContext): boolean {
  return ctx.areaLoading || ctx.contextLost === true || (!ctx.paused && ctx.documentHidden);
}

export type SaveFlushContext = {
  qaActive: boolean;
  titleOpen: boolean;
  area: string;
  inFinale: boolean;
  inBattle: boolean;
  inArcade: boolean;
  autosaveNeeded: boolean;
};

/**
 * Returns true when hiding or unloading the page should flush an immediate
 * quiet autosave, guarding QA mode, title, harness, finale/credits, and
 * mid-battle or mid-arcade states.
 */
export function shouldFlushSaveOnHide(ctx: SaveFlushContext): boolean {
  return (
    !ctx.qaActive &&
    !ctx.titleOpen &&
    ctx.area !== "harness" &&
    !ctx.inFinale &&
    !ctx.inBattle &&
    !ctx.inArcade &&
    ctx.autosaveNeeded
  );
}

export type WebGlRecoveryTarget = Pick<
  HTMLCanvasElement,
  "addEventListener" | "removeEventListener"
>;

export type WebGlRecoveryCallbacks = {
  onLost: () => void;
  onRestored: () => void;
};

/**
 * Listens for WebGL context loss/restoration on the game canvas, calling
 * `event.preventDefault()` on loss so the browser/GPU can restore the context.
 */
export function bindWebGlRecovery(
  canvas: WebGlRecoveryTarget,
  callbacks: WebGlRecoveryCallbacks,
): { dispose: () => void } {
  const handleLost = (event: Event): void => {
    event.preventDefault();
    callbacks.onLost();
  };
  const handleRestored = (): void => {
    callbacks.onRestored();
  };
  canvas.addEventListener("webglcontextlost", handleLost);
  canvas.addEventListener("webglcontextrestored", handleRestored);
  return {
    dispose: () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    },
  };
}

function summarizeBootError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return "Something went sideways while opening the sketchbook.";
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
}

/**
 * Renders a self-contained Cloverhollow storybook recovery card inside `root`
 * when `boot()` rejects, with zero runtime cost on normal boot.
 */
export function renderBootError(root: HTMLElement | null, error: unknown): void {
  if (root === null) return;
  const doc = root.ownerDocument;
  const wrap = doc.createElement("div");
  wrap.className = "boot-error-wrap";
  wrap.setAttribute("role", "alert");
  wrap.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "width:100%",
    "height:100%",
    "padding:24px",
    "box-sizing:border-box",
    "background:#f8edcf",
    "color:#47321f",
    "font-family:'Fredoka','Nunito','Trebuchet MS',system-ui,sans-serif",
  ].join(";");

  const card = doc.createElement("div");
  card.className = "boot-error-card";
  card.style.cssText = [
    "max-width:420px",
    "width:100%",
    "padding:24px 28px",
    "background:#fff9eb",
    "border:3px solid #47321f",
    "border-radius:20px",
    "box-shadow:0 6px 0 #47321f",
    "text-align:center",
  ].join(";");

  const heading = doc.createElement("h1");
  heading.textContent = "Cloverhollow hit a bump!";
  heading.style.cssText = "margin:0 0 10px;font-size:24px;line-height:1.2;color:#47321f;";

  const summary = doc.createElement("p");
  summary.className = "boot-error-detail";
  summary.textContent = summarizeBootError(error);
  summary.style.cssText = [
    "margin:0 0 18px",
    "font-size:15px",
    "line-height:1.45",
    "color:#5f4630",
    "word-break:break-word",
  ].join(";");

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "boot-error-reload";
  button.textContent = "Reload";
  button.style.cssText = [
    "padding:10px 24px",
    "font:inherit",
    "font-size:16px",
    "font-weight:700",
    "color:#47321f",
    "background:#a2ce8f",
    "border:2.5px solid #47321f",
    "border-radius:999px",
    "box-shadow:0 3px 0 #47321f",
    "cursor:pointer",
  ].join(";");
  button.addEventListener("click", () => {
    if (typeof window !== "undefined") window.location.reload();
  });

  card.append(heading, summary, button);
  wrap.append(card);
  root.replaceChildren(wrap);
}
