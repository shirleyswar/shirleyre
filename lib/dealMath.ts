/**
 * Deal commission constants — single source of truth.
 * HOUSE_SPLIT: the broker keeps 75% of gross commission; house takes 25%.
 * Applied to every est_commission calculation in the app.
 * co_brokers splits gross before it reaches this split — separate axis, not modelled here.
 */
export const HOUSE_SPLIT = 0.75
