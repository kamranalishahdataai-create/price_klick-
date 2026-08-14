// Guest usage limits — signed-out visitors get a few free tries of each tool
// (lens scans, coupon lookups, service searches) to make them aware, then are
// prompted to sign up. Signed-in members are never limited (enforce these only
// when !isAuthenticated). Counters live in localStorage, per feature.

export const GUEST_LIMIT = 3

const keyOf = (name) => `pk_guest_${name}_used`

export function guestUsed(name) {
  const v = Number(localStorage.getItem(keyOf(name)))
  return Number.isFinite(v) && v > 0 ? Math.min(v, GUEST_LIMIT) : 0
}

export function guestLeft(name) {
  return Math.max(0, GUEST_LIMIT - guestUsed(name))
}

// Records one use and returns the remaining count.
export function guestSpend(name) {
  const next = Math.min(GUEST_LIMIT, guestUsed(name) + 1)
  localStorage.setItem(keyOf(name), String(next))
  return GUEST_LIMIT - next
}
