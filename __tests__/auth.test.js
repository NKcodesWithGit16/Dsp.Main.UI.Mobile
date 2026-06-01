import { readUserFromToken } from '../src/utils/auth';

// Minimal JWT-like token. We don't validate signatures — the API does — but we
// parse claims to know which screen to route to and whether to consider the
// session valid. This test guards that the parsing matches our expectations.

function makeToken(payload) {
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return [enc({ alg: 'HS256', typ: 'JWT' }), enc(payload), 'sig'].join('.');
}

describe('readUserFromToken', () => {
  test('returns null for empty token', () => {
    expect(readUserFromToken('')).toBeNull();
    expect(readUserFromToken(null)).toBeNull();
  });

  test('returns null for malformed token', () => {
    expect(readUserFromToken('not-a-jwt')).toBeNull();
  });

  test('extracts userId and role from a valid token', () => {
    const tok = makeToken({
      sub: 'u123',
      role: 'dispatcher',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const claims = readUserFromToken(tok);
    expect(claims).toBeTruthy();
    expect(claims.userId).toBe('u123');
    expect(['dispatcher', 'driver', 'broker', 'admin']).toContain(claims.role);
  });

  test('treats expired tokens as invalid', () => {
    const tok = makeToken({
      sub: 'u123',
      role: 'dispatcher',
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    const claims = readUserFromToken(tok);
    expect(claims).toBeNull();
  });
});
