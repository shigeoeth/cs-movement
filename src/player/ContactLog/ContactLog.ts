/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Plane contacts hit during one tick, kept as raw numbers so the hot path
// never formats strings; text is built only when something asks for it
// (BlockedMove's warning, TickHistory dumps).

import type { Vec3 } from '../../math/vec3.js';
import { CONTACT_CAPACITY, CONTACT_DECIMALS, CONTACT_STRIDE } from './ContactLog.config.js';

export class ContactLog {
  readonly data = new Float64Array(CONTACT_CAPACITY * CONTACT_STRIDE);
  count = 0;

  push(normal: Vec3, fraction: number): void {
    if (this.count === CONTACT_CAPACITY) return;
    const o = this.count++ * CONTACT_STRIDE;
    this.data[o] = normal.x;
    this.data[o + 1] = normal.y;
    this.data[o + 2] = normal.z;
    this.data[o + 3] = fraction;
  }

  clear(): void {
    this.count = 0;
  }

  /** Space-separated "nx,ny,nz@fraction" entries. */
  toString(): string {
    return formatContacts(this.data, 0, this.count);
  }
}

export function formatContacts(data: ArrayLike<number>, offset: number, count: number): string {
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const o = offset + i * CONTACT_STRIDE;
    parts.push(
      `${data[o].toFixed(CONTACT_DECIMALS)},${data[o + 1].toFixed(CONTACT_DECIMALS)},${data[o + 2].toFixed(CONTACT_DECIMALS)}@${data[o + 3].toFixed(CONTACT_DECIMALS)}`,
    );
  }
  return parts.join(' ');
}
