import { targetInteractable, type State, type World } from "../core";

export function createStateLogger(world: World): (state: State) => void {
  let previous: State | undefined;
  let lastPositionLog = -Infinity;
  let first = true;
  let previousDialogue = "";
  let previousMoving: boolean | undefined;
  let previousTarget: string | null | undefined;
  return (state: State): void => {
    const areaChanged = previous !== undefined && state.area !== previous.area;
    const facingChanged = previous !== undefined && state.facing !== previous.facing;
    const positionChanged =
      previous !== undefined &&
      (state.player.x !== previous.player.x || state.player.y !== previous.player.y);
    const now = performance.now();
    const dialogue = state.dialogue;
    const dialogueKey = dialogue === null
      ? "closed"
      : `open|${dialogue.speaker ?? ""}|${dialogue.text}`;
    const dialogueChanged = dialogueKey !== previousDialogue;
    const target = targetInteractable(world, state)?.id ?? null;
    const movementChanged = previousMoving !== state.motion.moving ||
      previousTarget !== target;
    const journalChanged = previous !== undefined && previous.journalOpen !== state.journalOpen;
    if (
      first ||
      areaChanged ||
      facingChanged ||
      (positionChanged && now - lastPositionLog >= 250) || dialogueChanged ||
      movementChanged || journalChanged
    ) {
      console.log(
        `[cloverhollow] state ${JSON.stringify({
          tick: state.tick,
          area: state.area,
          x: Math.round(state.player.x),
          y: Math.round(state.player.y),
          facing: state.facing,
          moving: state.motion.moving,
          target,
          journal: state.journalOpen,
        })}`,
      );
      lastPositionLog = now;
      first = false;
    }
    if (dialogueChanged) {
      console.log(`[cloverhollow] dialogue ${JSON.stringify({
        open: dialogue !== null,
        speaker: dialogue?.speaker ?? null,
        text: dialogue?.text ?? "",
      })}`);
      previousDialogue = dialogueKey;
      // After the next paint, log where the box actually landed.
      if (dialogue !== null) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const box = document.querySelector(".sticker-dialogue")?.getBoundingClientRect();
          if (box === undefined) return;
          console.log(`[cloverhollow] dialogue-box ${JSON.stringify({
            x: Math.round(box.x), y: Math.round(box.y),
            width: Math.round(box.width), height: Math.round(box.height),
          })}`);
        }));
      }
    }
    previous = state;
    previousMoving = state.motion.moving;
    previousTarget = target;
  };
}

// Every pointer press, with where it landed and what it hit.
export function logPointers(): void {
  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target.className : "";
    console.log(`[cloverhollow] pointer ${JSON.stringify({
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      type: event.pointerType,
      target: typeof target === "string" ? target : "",
    })}`);
  }, { capture: true });
}

export function logTouchLayout(): void {
  const names = ["confirm", "cancel", "menu"] as const;
  const layout = Object.fromEntries(names.map((name) => {
    const element = document.querySelector(`.touch-${name}`);
    const rect = element?.getBoundingClientRect();
    return [name, rect === undefined
      ? null
      : { x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
  }));
  console.log(`[cloverhollow] layout ${JSON.stringify(layout)}`);
}
