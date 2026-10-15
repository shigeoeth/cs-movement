import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { World } from '../../physics/World/World';
import { DEFAULT_SETTINGS } from '../../settings/Settings.config';
import { PlayerController } from '../PlayerController';
import { HISTORY_CAPACITY } from './TickHistory.config';

describe('tick history', () => {
  it('keeps the newest ticks, oldest first, in the documented line format', () => {
    const world = new World();
    world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
    world.solids.push(brushFromAABB(vec3(100, 0, -50), vec3(120, 80, 50))); // walls either side, so yaw direction doesn't matter
    world.solids.push(brushFromAABB(vec3(-120, 0, -50), vec3(-100, 80, 50)));
    const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 0, 0));
    player.yaw = 90;
    player.input.forward = true;
    for (let i = 0; i < 150; i++) player.tick(1 / 128);
    const early = player.tickHistoryText().split('\n');
    expect(early).toHaveLength(150);
    expect(early[0].startsWith('0 p ')).toBe(true);
    for (let i = 0; i < HISTORY_CAPACITY; i++) player.tick(1 / 128);

    const lines = player.tickHistoryText().split('\n');
    expect(lines).toHaveLength(HISTORY_CAPACITY);
    expect(lines[0].startsWith('150 p ')).toBe(true);
    expect(lines.at(-1)).toMatch(/^\d+ p -?\d+\.\d,-?\d+\.\d,-?\d+\.\d v -?\d+\.\d,-?\d+\.\d,-?\d+\.\d [GA]s?L?d? in:W/);
    expect(early.some((l) => / c\[-?\d+\.\d\d,-?\d+\.\d\d,-?\d+\.\d\d@\d+\.\d\d/.test(l))).toBe(true);
  });
});
