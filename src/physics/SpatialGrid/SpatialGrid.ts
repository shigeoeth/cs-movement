/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Uniform XZ grid over brush AABBs. A query returns the indices of every
// brush whose AABB could overlap a bounds box, in ascending index order —
// a superset of what the linear broadphase accepts, so tracing against the
// candidates gives bit-identical results to scanning every brush.

import type { Brush } from '../Collision/Collision.types.js';
import {
  GRID_CELL_SIZE,
  GRID_KEY_STRIDE,
  GRID_MAX_CELLS_PER_BRUSH,
  GRID_MAX_QUERY_CELLS,
} from './SpatialGrid.config.js';

const INV_CELL = 1 / GRID_CELL_SIZE;

export class SpatialGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly oversized: number[] = [];
  private readonly stamp: Uint32Array;
  private stampCounter = 0;
  /** Result of the last query: ids[0..count) ascending. */
  ids = new Int32Array(64);
  count = 0;

  constructor(brushes: readonly Brush[]) {
    this.stamp = new Uint32Array(brushes.length);
    for (let i = 0; i < brushes.length; i++) {
      const b = brushes[i];
      const x0 = Math.floor(b.min.x * INV_CELL);
      const x1 = Math.floor(b.max.x * INV_CELL);
      const z0 = Math.floor(b.min.z * INV_CELL);
      const z1 = Math.floor(b.max.z * INV_CELL);
      if (!((x1 - x0 + 1) * (z1 - z0 + 1) <= GRID_MAX_CELLS_PER_BRUSH)) {
        this.oversized.push(i); // also catches NaN/Infinity bounds
        continue;
      }
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const key = ix * GRID_KEY_STRIDE + iz;
          const cell = this.cells.get(key);
          if (cell) cell.push(i);
          else this.cells.set(key, [i]);
        }
      }
    }
  }

  /** Gathers candidates for bounds [minX,minY,minZ,maxX,maxY,maxZ]. Returns false if the caller should scan linearly. */
  query(bounds: Float64Array): boolean {
    const x0 = Math.floor(bounds[0] * INV_CELL);
    const x1 = Math.floor(bounds[3] * INV_CELL);
    const z0 = Math.floor(bounds[2] * INV_CELL);
    const z1 = Math.floor(bounds[5] * INV_CELL);
    if (!((x1 - x0 + 1) * (z1 - z0 + 1) <= GRID_MAX_QUERY_CELLS)) return false;

    if (++this.stampCounter > 0xffffffff) {
      this.stamp.fill(0);
      this.stampCounter = 1;
    }
    const mark = this.stampCounter;
    this.count = 0;
    for (let i = 0; i < this.oversized.length; i++) this.add(this.oversized[i], mark);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const cell = this.cells.get(ix * GRID_KEY_STRIDE + iz);
        if (cell) for (let k = 0; k < cell.length; k++) this.add(cell[k], mark);
      }
    }
    this.sortIds();
    return true;
  }

  private add(id: number, mark: number): void {
    if (this.stamp[id] === mark) return;
    this.stamp[id] = mark;
    if (this.count === this.ids.length) {
      const grown = new Int32Array(this.ids.length * 2);
      grown.set(this.ids);
      this.ids = grown;
    }
    this.ids[this.count++] = id;
  }

  /** Candidate lists are tiny, so insertion sort beats anything fancier. */
  private sortIds(): void {
    const ids = this.ids;
    for (let i = 1; i < this.count; i++) {
      const v = ids[i];
      let j = i - 1;
      while (j >= 0 && ids[j] > v) {
        ids[j + 1] = ids[j];
        j--;
      }
      ids[j + 1] = v;
    }
  }
}
