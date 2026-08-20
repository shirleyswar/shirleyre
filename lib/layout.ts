// War Room layout constants — shared between components to avoid silent misalignment.
// If the nav height ever changes, change it here. Dependent components pick it up automatically.

/** Bottom tab bar total outer height (box-sizing: border-box, includes env(safe-area-inset-bottom)). */
export const NAV_HEIGHT = 94

/** Sheet containers must clear the full nav box to avoid footer occlusion. */
export const SHEET_BOTTOM_CLEARANCE = NAV_HEIGHT
