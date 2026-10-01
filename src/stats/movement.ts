// Movement is derived, not tagged (ADR-0026, renamed in ADR-0028): the lateral
// movement from the setup's lane to the hole's lane. A setup covers its whole lane, so from the
// pull side both pull holes are Straight.
import type { Hole, Movement, Setup } from '../data/types'

const SETUP_LANE: Record<Setup, number> = { 'Pull side': -1, Middle: 0, 'Push side': 1 }
const HOLE_LANE: Record<Hole, number> = { 'Pull long': -1, 'Pull short': -1, Middle: 0, 'Push short': 1, 'Push long': 1 }

/** Null when either the setup or the hole is blank. */
export function movementOf(setup: Setup | null, hole: Hole | null): Movement | null {
  if (setup == null || hole == null) return null
  const d = HOLE_LANE[hole] - SETUP_LANE[setup]
  return d < 0 ? 'Pull' : d > 0 ? 'Push' : 'Straight'
}
