// Derive the user's role from the JWT, not from a separate AsyncStorage key.
// Flipping the stored role used to grant access to any group; now an attacker
// would need to forge a token, which the backend will reject.
//
// THIS IS UX HARDENING, NOT SECURITY. The actual access boundary is the
// backend [Authorize(Roles = "...")] checks on each controller. Anything the
// client decides can be patched out of the shipped app by a determined user.

const ROLE_BY_NUMBER = { 1: 'admin', 2: 'dispatcher', 3: 'driver', 4: 'broker' };

const ROLE_CLAIM_KEYS = [
  'role',
  'roles',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
];

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const fixed = pad ? padded + '='.repeat(4 - pad) : padded;
  // RN provides global atob in Hermes; fall back to Buffer if missing.
  if (typeof atob === 'function') return atob(fixed);
  // eslint-disable-next-line no-undef
  return Buffer.from(fixed, 'base64').toString('binary');
}

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
}

function normalizeRole(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    for (const v of value) {
      const r = normalizeRole(v);
      if (r) return r;
    }
    return null;
  }
  if (typeof value === 'number') return ROLE_BY_NUMBER[value] ?? null;
  const s = String(value).toLowerCase();
  if (ROLE_BY_NUMBER[s]) return ROLE_BY_NUMBER[s];
  if (['admin', 'dispatcher', 'driver', 'broker'].includes(s)) return s;
  return null;
}

export function readUserFromToken(token) {
  const claims = decodeJwt(token);
  if (!claims) return null;
  if (claims.exp && Date.now() / 1000 > claims.exp) return null;

  let role = null;
  for (const key of ROLE_CLAIM_KEYS) {
    if (claims[key] !== undefined) {
      role = normalizeRole(claims[key]);
      if (role) break;
    }
  }

  const userId =
    claims.sub ??
    claims.userId ??
    claims.nameid ??
    claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ??
    null;

  return { userId: userId != null ? String(userId) : null, role, exp: claims.exp ?? null };
}
