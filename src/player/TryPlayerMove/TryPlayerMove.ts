/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { STANDABLE_NORMAL } from '../../constants.js';
import { copy, cross, dot, lengthSq, normalize, scale, addScaled, set, vec3, type Vec3 } from '../../math/vec3.js';
import { clipVelocity } from '../../physics/ClipVelocity/ClipVelocity.js';
import { OVERBOUNCE_DEFAULT, OVERBOUNCE_SURF } from '../../physics/ClipVelocity/ClipVelocity.config.js';
import type { MovementContext } from '../MovementContext.js';
import { MAX_CLIP_PLANES } from './TryPlayerMove.config.js';

// Scratch state, reused every call (tryPlayerMove is not re-entrant).
const planePool: Vec3[] = Array.from({ length: MAX_CLIP_PLANES }, () => vec3());
const originalVel = vec3();
const primalVel = vec3();

function overbounceFor(normal: Vec3): number {
  // Surf-steep slopes clip with exactly 1.0 so no speed is bled; everything
  // else (floors, walls, ceilings) uses 1.001.
  const ny = normal.y;
  return ny > 0.05 && ny < STANDABLE_NORMAL ? OVERBOUNCE_SURF : OVERBOUNCE_DEFAULT;
}

/**
 * Source's TryPlayerMove: sweep, clip velocity against every plane touched
 * this tick (creases slide along the shared edge), repeat up to 4 bumps.
 */
export function tryPlayerMove(ctx: MovementContext, dt: number): void {
  let timeLeft = dt;
  let planeCount = 0;
  copy(originalVel, ctx.velocity);
  copy(primalVel, ctx.velocity);
  ctx.surfing = false;

  for (let bump = 0; bump < 4; bump++) {
    if (lengthSq(ctx.velocity) === 0) break;

    addScaled(ctx.moveEnd, ctx.origin, ctx.velocity, timeLeft);
    const tr = ctx.world.trace(ctx.origin, ctx.moveEnd, ctx.mins, ctx.maxs, ctx.traceResult);

    if (tr.allSolid) {
      ctx.log('tryPlayerMove: allSolid — velocity zeroed');
      set(ctx.velocity, 0, 0, 0);
      return;
    }
    if (tr.fraction > 0) {
      copy(ctx.origin, tr.endPos);
      copy(originalVel, ctx.velocity);
      planeCount = 0;
    }
    if (tr.fraction === 1) break;

    const n = tr.normal!;
    ctx.contactsThisTick.push(n, tr.fraction);

    timeLeft -= timeLeft * tr.fraction;

    if (planeCount >= MAX_CLIP_PLANES) {
      ctx.log('tryPlayerMove: exceeded MAX_CLIP_PLANES — velocity zeroed');
      set(ctx.velocity, 0, 0, 0);
      return;
    }
    // Zero-fraction bumps re-report the plane we're already resting
    // against; accumulating the duplicate would make the crease fallback
    // compute cross(n, n) = 0 and kill all velocity (ramp "sticking").
    let duplicate = false;
    for (let k = 0; k < planeCount; k++) {
      if (dot(planePool[k], n) > 0.99) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) copy(planePool[planeCount++], n);
    if (tr.normal!.y > 0.05 && tr.normal!.y < STANDABLE_NORMAL) ctx.surfing = true;

    // Find a clip of the original velocity that doesn't re-enter any plane.
    let i = 0;
    for (; i < planeCount; i++) {
      copy(ctx.velocity, originalVel);
      clipVelocity(ctx.velocity, planePool[i], overbounceFor(planePool[i]));
      let ok = true;
      for (let j = 0; j < planeCount; j++) {
        if (j !== i && dot(ctx.velocity, planePool[j]) < 0) {
          ok = false;
          break;
        }
      }
      if (ok) break;
    }

    if (i === planeCount) {
      // No single plane worked — slide along the crease of the first two.
      if (planeCount !== 2) {
        ctx.log(`tryPlayerMove: cornered by ${planeCount} planes — velocity zeroed`);
        set(ctx.velocity, 0, 0, 0);
        return;
      }
      cross(ctx.tmpB, planePool[0], planePool[1]);
      const creaseLen = normalize(ctx.tmpB);
      if (creaseLen < 1e-6) {
        // Degenerate (near-parallel planes): fall back to a single clip
        // rather than zeroing the move.
        ctx.log('tryPlayerMove: degenerate crease — single-plane fallback');
        copy(ctx.velocity, originalVel);
        clipVelocity(ctx.velocity, planePool[0], overbounceFor(planePool[0]));
      } else {
        scale(ctx.velocity, ctx.tmpB, dot(ctx.tmpB, ctx.velocity));
      }
    }

    // If we've been deflected back on ourselves, stop dead (prevents
    // oscillating in corners).
    if (dot(ctx.velocity, primalVel) <= 0) {
      set(ctx.velocity, 0, 0, 0);
      return;
    }
  }
}
