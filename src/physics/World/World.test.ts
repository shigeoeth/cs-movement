import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB, brushFromOrientedBox, traceBox } from '../Collision/Collision';
import { GRID_MIN_BRUSHES } from '../SpatialGrid/SpatialGrid.config';
import { World } from './World';

const MINS = vec3(-16, 0, -16);
const MAXS = vec3(16, 72, 16);

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function scatteredWorld(count: number, seed: number): World {
  const rand = lcg(seed);
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-4000, -16, -4000), vec3(4000, 0, 4000))); // oversized: never binned
  for (let i = 0; i < count; i++) {
    const cx = (rand() * 2 - 1) * 1500;
    const cz = (rand() * 2 - 1) * 1500;
    if (rand() < 0.4) {
      const t = 0.3 + rand() * 0.6;
      const c = Math.sqrt(1 - t * t);
      world.solids.push(
        brushFromOrientedBox(vec3(cx, 60 + rand() * 60, cz), vec3(90, 6, 90), vec3(1, 0, 0), vec3(0, c, t), vec3(0, -t, c)),
      );
    } else {
      const w = 16 + rand() * 90;
      world.solids.push(brushFromAABB(vec3(cx - w, 0, cz - w), vec3(cx + w, 8 + rand() * 60, cz + w)));
    }
  }
  return world;
}

function randomPoint(rand: () => number): ReturnType<typeof vec3> {
  return vec3((rand() * 2 - 1) * 1600, rand() * 160, (rand() * 2 - 1) * 1600);
}

describe('World spatial index', () => {
  it('indexes only above the brush-count threshold', () => {
    expect(GRID_MIN_BRUSHES).toBeGreaterThan(1);
  });

  it('traces identically to a linear scan of every brush', () => {
    const world = scatteredWorld(400, 7);
    const rand = lcg(99);
    for (let i = 0; i < 3000; i++) {
      const start = randomPoint(rand);
      const long = rand() < 0.1; // a few sweeps wide enough to hit the linear fallback
      const reach = long ? 3000 : 120;
      const end = vec3(start.x + (rand() * 2 - 1) * reach, start.y + (rand() * 2 - 1) * 120, start.z + (rand() * 2 - 1) * reach);
      const indexed = world.trace(start, end, MINS, MAXS);
      const linear = traceBox(start, end, MINS, MAXS, world.solids);
      expect(indexed).toEqual(linear);
      expect(indexed.normal).toBe(linear.normal); // same plane object, not just an equal one
    }
  });

  it('isPositionFree matches a linear startSolid check', () => {
    const world = scatteredWorld(400, 11);
    const rand = lcg(5);
    let blocked = 0;
    for (let i = 0; i < 3000; i++) {
      const p = randomPoint(rand);
      const expected = !traceBox(p, p, MINS, MAXS, world.solids).startSolid;
      if (!expected) blocked++;
      expect(world.isPositionFree(p, MINS, MAXS)).toBe(expected);
    }
    expect(blocked).toBeGreaterThan(0);
  });

  it('picks up brushes pushed after the first query', () => {
    const world = scatteredWorld(200, 3);
    const start = vec3(0, 200, 0);
    const end = vec3(0, 100, 0);
    expect(world.trace(start, end, MINS, MAXS).fraction).toBe(1);
    world.solids.push(brushFromAABB(vec3(-50, 120, -50), vec3(50, 140, 50)));
    expect(world.trace(start, end, MINS, MAXS).fraction).toBeLessThan(1);
  });

  it('rebuildIndex picks up in-place brush edits', () => {
    const world = scatteredWorld(200, 3);
    const start = vec3(0, 200, 0);
    const end = vec3(0, 100, 0);
    const slab = brushFromAABB(vec3(5000, 120, 5000), vec3(5100, 140, 5100));
    world.solids.push(slab);
    expect(world.trace(start, end, MINS, MAXS).fraction).toBe(1);
    const moved = brushFromAABB(vec3(-50, 120, -50), vec3(50, 140, 50));
    world.solids[world.solids.length - 1] = moved;
    world.rebuildIndex();
    expect(world.trace(start, end, MINS, MAXS).fraction).toBeLessThan(1);
  });

  it('reuses a caller-provided result object', () => {
    const world = scatteredWorld(100, 1);
    const out = world.trace(vec3(0, 50, 0), vec3(0, -50, 0), MINS, MAXS);
    expect(world.trace(vec3(0, 50, 0), vec3(0, -50, 0), MINS, MAXS, out)).toBe(out);
  });
});
