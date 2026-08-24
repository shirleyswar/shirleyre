/**
 * Deal commission calculator — single source of truth.
 * HOUSE_SPLIT: broker keeps 75%, house takes 25%.
 *
 * Check 48: Commission rate model with two fields:
 *   listing_rate: full listing commission % (e.g. 6.00)
 *   co_broker_on: whether co-broker split is active (default 50% split)
 *   co_broker_split: co-broker share fraction (default 0.50)
 *
 * New records: effective_rate = listing_rate × (co_broker_on ? co_broker_split : 1)
 * Existing records: stored rate already baked in — use as-is (co_broker_on=false).
 *
 * Both functions return null if any required input is null.
 * A missing figure is not zero.
 */
export const HOUSE_SPLIT = 0.75

/** Check 48: default co-broker split fraction */
export const DEFAULT_CO_BROKER_SPLIT = 0.50

/**
 * Check 48: Compute effective commission rate from listing rate + co-broker fields.
 * co_broker_on: if true, multiply by co_broker_split (defaults to 0.50).
 * Existing records (co_broker_on=false) pass their stored rate through unchanged.
 */
export function effectiveRate(
  listing_rate: number,
  co_broker_on: boolean,
  co_broker_split: number = DEFAULT_CO_BROKER_SPLIT,
): number {
  if (co_broker_on) return listing_rate * co_broker_split
  return listing_rate
}

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
 * Lease total value (base rent across the full term).
 * value = sqft × lease_rate_psf × lease_term_years
 * Returns null if any input is null.
 */
export function calcLeaseValue(
  sqft: number | null,
  lease_rate_psf: number | null,
  lease_term_years: number | null,
): number | null {
  if (sqft == null || lease_rate_psf == null || lease_term_years == null) return null
  return Math.round(sqft * lease_rate_psf * lease_term_years)
}

/**
 * Format a commission or value for display. Null → em-dash.
 * Check 34: values ≥1M → "$1.2M", ≥1K → "$43K", else full.
 */
export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}
