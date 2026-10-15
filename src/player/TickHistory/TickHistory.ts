/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Rolling per-tick record for PlayerController.tickHistoryText(). Recording
// copies a few numbers into preallocated typed arrays; all string formatting
// is deferred to dump time, so an unread history costs almost nothing.

import { CONTACT_CAPACITY, CONTACT_STRIDE } from '../ContactLog/ContactLog.config.js';
import { formatContacts } from '../ContactLog/ContactLog.js';
import type { MovementContext } from '../MovementContext.js';
import { HISTORY_CAPACITY } from './TickHistory.config.js';

const KEY_BITS = [
  ['W', 'forward'],
  ['S', 'back'],
  ['A', 'left'],
  ['D', 'right'],
  ['J', 'jump'],
  ['C', 'duck'],
  ['H', 'walk'],
] as const;

const FLAG_ON_GROUND = 1;
const FLAG_SURFING = 2;
const FLAG_LADDER = 4;
const FLAG_DUCKED = 8;

export class TickHistory {
  private total = 0;
  private readonly state = new Float64Array(HISTORY_CAPACITY * 6); // origin xyz, velocity xyz
  private readonly keys = new Uint8Array(HISTORY_CAPACITY);
  private readonly flags = new Uint8Array(HISTORY_CAPACITY);
  private readonly contactCounts = new Uint8Array(HISTORY_CAPACITY);
  private readonly contacts = new Float32Array(HISTORY_CAPACITY * CONTACT_CAPACITY * CONTACT_STRIDE);

  record(ctx: MovementContext): void {
    const slot = this.total % HISTORY_CAPACITY;
    const s = slot * 6;
    this.state[s] = ctx.origin.x;
    this.state[s + 1] = ctx.origin.y;
    this.state[s + 2] = ctx.origin.z;
    this.state[s + 3] = ctx.velocity.x;
    this.state[s + 4] = ctx.velocity.y;
    this.state[s + 5] = ctx.velocity.z;

    let keys = 0;
    for (let i = 0; i < KEY_BITS.length; i++) if (ctx.input[KEY_BITS[i][1]]) keys |= 1 << i;
    this.keys[slot] = keys;
    this.flags[slot] =
      (ctx.onGround ? FLAG_ON_GROUND : 0) |
      (ctx.surfing ? FLAG_SURFING : 0) |
      (ctx.onLadder ? FLAG_LADDER : 0) |
      (ctx.ducked ? FLAG_DUCKED : 0);

    const n = ctx.contactsThisTick.count;
    this.contactCounts[slot] = n;
    const c = slot * CONTACT_CAPACITY * CONTACT_STRIDE;
    for (let i = 0; i < n * CONTACT_STRIDE; i++) this.contacts[c + i] = ctx.contactsThisTick.data[i];

    this.total++;
  }

  /** Recorded ticks, oldest first, one line each. */
  toString(): string {
    const lines: string[] = [];
    const first = Math.max(0, this.total - HISTORY_CAPACITY);
    for (let t = first; t < this.total; t++) {
      const slot = t % HISTORY_CAPACITY;
      const s = slot * 6;
      const st = this.state;
      let keys = '';
      for (let i = 0; i < KEY_BITS.length; i++) if (this.keys[slot] & (1 << i)) keys += KEY_BITS[i][0];
      const f = this.flags[slot];
      const flags =
        (f & FLAG_ON_GROUND ? 'G' : 'A') + (f & FLAG_SURFING ? 's' : '') + (f & FLAG_LADDER ? 'L' : '') + (f & FLAG_DUCKED ? 'd' : '');
      const n = this.contactCounts[slot];
      const contacts = n > 0 ? ` c[${formatContacts(this.contacts, slot * CONTACT_CAPACITY * CONTACT_STRIDE, n)}]` : '';
      lines.push(
        `${t} p ${st[s].toFixed(1)},${st[s + 1].toFixed(1)},${st[s + 2].toFixed(1)} ` +
          `v ${st[s + 3].toFixed(1)},${st[s + 4].toFixed(1)},${st[s + 5].toFixed(1)} ${flags} in:${keys || '-'}${contacts}`,
      );
    }
    return lines.join('\n');
  }
}
