/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
/** Contacts remembered per tick (2 TryPlayerMove runs in StepMove x 4 bumps each); extras are dropped. */
export const CONTACT_CAPACITY = 8;
/** Floats stored per contact: normal x/y/z + trace fraction. */
export const CONTACT_STRIDE = 4;
/** Decimal places shown when a contact is formatted. */
export const CONTACT_DECIMALS = 2;
