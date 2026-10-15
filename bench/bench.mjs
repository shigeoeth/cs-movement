// Usage: node bench/bench.mjs <path-to-built-dist/index.js> [ticks]
// Deterministic scripted bhop/strafe run through a scattered brush field.
// Prints one JSON line per world size: ns/tick, plus a checksum so optimized
// builds can be proven bit-identical to the baseline.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const lib = await import(pathToFileURL(resolve(process.argv[2])).href);
const TICKS = Number(process.argv[3] ?? 60000);
const SIZES = [50, 500, 5000, 20000];
const DT = 1 / 128;
const { World, PlayerController, brushFromAABB, brushFromOrientedBox, vec3, DEFAULT_SETTINGS } = lib;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function buildWorld(n) {
  const rand = rng(1234);
  const world = new World();
  const half = Math.sqrt(n) * 160;
  world.solids.push(brushFromAABB(vec3(-half * 8, -16, -half * 8), vec3(half * 8, 0, half * 8))); // wide floor so the run never falls off
  for (let i = 1; i < n; i++) {
    const cx = (rand() * 2 - 1) * half;
    const cz = (rand() * 2 - 1) * half;
    if (Math.abs(cx) < 160 && Math.abs(cz) < 160) continue; // keep the spawn clear
    const h = 8 + rand() * 40;
    if (rand() < 0.4) {
      const t = 0.4 + rand() * 0.5;
      const c = Math.sqrt(1 - t * t);
      world.solids.push(
        brushFromOrientedBox(vec3(cx, 60 + rand() * 40, cz), vec3(80, 6, 80), vec3(1, 0, 0), vec3(0, c, t), vec3(0, -t, c)),
      );
    } else {
      const w = 24 + rand() * 80;
      world.solids.push(brushFromAABB(vec3(cx - w, 0, cz - w), vec3(cx + w, h, cz + w)));
    }
  }
  return world;
}

function run(n) {
  const world = buildWorld(n);
  const p = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 4, 0));
  let sum = 0;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < TICKS; i++) {
    p.yaw = (i * 0.45) % 360;
    p.input.forward = true;
    p.input.right = (i >> 5) & 1;
    p.input.left = !p.input.right;
    p.input.jump = (i & 3) !== 0;
    p.input.duck = (i % 700) > 650;
    p.input.reset = p.stuckTicks > 30;
    p.tick(DT);
    sum += p.origin.x * 1.1 + p.origin.y * 1.7 + p.origin.z * 1.3 + p.velocity.x * 0.3 + p.velocity.y * 0.5 + p.velocity.z * 0.7;
  }
  const ns = Number(process.hrtime.bigint() - t0);
  return { brushes: n, finalSpeed: Math.round(p.horizontalSpeed), nsPerTick: Math.round(ns / TICKS), checksum: sum.toPrecision(17) };
}

run(SIZES[0]); // warm JIT
for (const n of SIZES) console.log(JSON.stringify(run(n)));
