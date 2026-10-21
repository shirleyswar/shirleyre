/** Square feet in one acre. */
export const SQFT_PER_ACRE = 43560

/**
 * A land figure above this is square feet stored in a column that the
 * screen labels as acres. 500 acres is still a real tract; 81,849 is not.
 */
export const LAND_SF_CUTOFF = 500

/** Acres, or null when the figure was never entered. Zero is absence. */
export function acresFromLand(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(Number(n))) return null
  const value = Number(n)
  if (value === 0) return null
  return value > LAND_SF_CUTOFF ? value / SQFT_PER_ACRE : value
}

/** "1.88 AC". Blank when there is no figure. */
export function fmtAcres(n: number | null | undefined): string {
  const acres = acresFromLand(n)
  if (acres == null) return ''
  return `${acres.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AC`
}
