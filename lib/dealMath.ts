/**
 * Deal commission calculator — single source of truth.
 * HOUSE_SPLIT: broker keeps 75%, house takes 25%.
 * co_brokers splits gross before this — separate axis, not modelled here.
 *
 * Both functions return null if any required input is null.
 * A missing figure is not zero.
 */
export const HOUSE_SPLIT = 0.75

/**
 * Sale commission estimate.
 * gross = asking_price × (sale_commission_pct / 100)
 * net   = gross × HOUSE_SPLIT
 */
export function calcSaleCommission(
  asking_price: number | null,
  sale_commission_pct: number | null,
): number | null {
  if (asking_price == null || sale_commission_pct == null) return null
  const gross = asking_price * (sale_commission_pct / 100)
  return Math.round(gross * HOUSE_SPLIT)
}

/**
 * Lease commission estimate.
 * base_rent = sqft × lease_rate_psf × lease_term_years  (NNN excluded)
 * gross     = base_rent × (lease_commission_pct / 100)
 * net       = gross × HOUSE_SPLIT
 * Flat across the term — no escalation.
 */
export function calcLeaseCommission(
  sqft: number | null,
  lease_rate_psf: number | null,
  lease_term_years: number | null,
  lease_commission_pct: number | null,
): number | null {
  if (sqft == null || lease_rate_psf == null || lease_term_years == null || lease_commission_pct == null) return null
  const base_rent = sqft * lease_rate_psf * lease_term_years
  const gross = base_rent * (lease_commission_pct / 100)
  return Math.round(gross * HOUSE_SPLIT)
}

/**
 * Route to sale or lease calculator based on transaction_type.
 * Returns null for missing data or unknown types.
 */
export function calcCommission(econ: {
  transaction_type: string | null
  asking_price?: number | null
  sale_commission_pct?: number | null
  sqft?: number | null
  lease_rate_psf?: number | null
  lease_term_years?: number | null
  lease_commission_pct?: number | null
} | null): number | null {
  if (!econ) return null
  const type = econ.transaction_type
  if (type === 'sale') {
    return calcSaleCommission(econ.asking_price ?? null, econ.sale_commission_pct ?? null)
  }
  if (type === 'lease') {
    return calcLeaseCommission(econ.sqft ?? null, econ.lease_rate_psf ?? null, econ.lease_term_years ?? null, econ.lease_commission_pct ?? null)
  }
  if (type === 'both') {
    // Try sale first; if not enough data, try lease
    const saleResult = calcSaleCommission(econ.asking_price ?? null, econ.sale_commission_pct ?? null)
    if (saleResult !== null) return saleResult
    return calcLeaseCommission(econ.sqft ?? null, econ.lease_rate_psf ?? null, econ.lease_term_years ?? null, econ.lease_commission_pct ?? null)
  }
  return null
}

/**
 * Format a commission or value for display. Null → em-dash.
 */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return '$' + n.toLocaleString()
}
