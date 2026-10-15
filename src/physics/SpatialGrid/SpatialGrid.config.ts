/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
/** Edge length of a grid cell in world units (XZ plane; Y is up). */
export const GRID_CELL_SIZE = 256;
/** Worlds with fewer brushes than this are faster to scan linearly. */
export const GRID_MIN_BRUSHES = 48;
/** Brushes covering more cells than this (floors, skyboxes) are tested on every query instead of being binned. */
export const GRID_MAX_CELLS_PER_BRUSH = 64;
/** A query touching more cells than this falls back to a linear scan. */
export const GRID_MAX_QUERY_CELLS = 256;
/** Cell coordinates are packed as ix * stride + iz; stride just has to exceed any real cell-coordinate span. */
export const GRID_KEY_STRIDE = 1 << 20;
