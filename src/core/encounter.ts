import type { Critter, FirstTouch, Point, State, Wild, WildMark, World } from "./types";

// Meeting a recurring critter (spec 8, Milestone 51). A critter takes a moment
// to notice Fae in its sight before it gives chase, so she can get to it
// first; one already after her can catch her. Once she has calmed enough of a
// species, its critters remember her and calm on touch.
//
//   in sight:  0 ...... "?" ...... noticeTicks ... "!" ... noticeTicks + alertTicks
//              wandering, unaware   |  chasing ------------------------------->
//                                   noticed

/**
 * The critter's notice count after a tick: one more while Fae is in its sight
 * (up to the end of its "!"), and back to 0 when she isn't.
 */
export function nextNotice(
  critter: Wild,
  inSight: boolean,
  roam: World["tunables"]["roam"],
): number {
  return inSight ? Math.min(roam.noticeTicks + roam.alertTicks, critter.notice + 1) : 0;
}

/** Whether a critter has noticed Fae (and so is after her). */
export function noticed(critter: Wild, roam: World["tunables"]["roam"]): boolean {
  return critter.notice >= roam.noticeTicks;
}

/**
 * Who got the jump as Fae, moving `from` to `to`, met a critter: she surprised
 * it if it hadn't noticed her; it caught her if it had and she wasn't walking
 * toward it (standing, or going any way but at it); else neither.
 */
export function firstTouch(
  critter: Wild,
  roam: World["tunables"]["roam"],
  from: Point,
  to: Point,
): FirstTouch {
  if (!noticed(critter, roam)) return "surprised";
  const toward = (to.x - from.x) * (critter.x - from.x) + (to.y - from.y) * (critter.y - from.y);
  return toward > 0 ? "even" : "caught";
}

/** Whether a species knows Fae well enough to calm on touch. */
export function oldFriend(world: World, state: State, critter: Critter): boolean {
  return (state.calms[critter.species] ?? 0) >= world.battle.oldFriends.calms;
}

/** The marks over chaos recurring critters' heads: "?" unaware, then "!". */
export function wildMarks(world: World, state: State): WildMark[] {
  const { noticeTicks, alertTicks } = world.tunables.roam;
  return state.wild.flatMap((critter): WildMark[] => {
    if (critter.mood !== "chaos" || critter.notice === 0 ||
      critter.notice >= noticeTicks + alertTicks) return [];
    return [{
      key: `wild:${critter.den}`,
      kind: critter.kind,
      point: { x: critter.x, y: critter.y },
      mark: critter.notice < noticeTicks ? "?" : "!",
    }];
  });
}
