/**
 * Central logger. In dev, prints with a tag so origin is obvious in Metro.
 * In production, this is the single place to wire Sentry / Bugsnag /
 * Datadog later — every screen already routes through it.
 *
 * Usage:
 *   import { log } from '../utils/logger';
 *   log.warn('LoadboardScreen', 'failed to fetch loads', err);
 */

function format(level, tag, ...args) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  const fn = console[level] || console.log;
  fn(`[${tag}]`, ...args);
}

export const log = {
  info:  (tag, ...args) => format('log',   tag, ...args),
  warn:  (tag, ...args) => format('warn',  tag, ...args),
  error: (tag, ...args) => {
    format('error', tag, ...args);
    // Hook for future Sentry/etc.:
    //   try { Sentry.captureException(args.find(a => a instanceof Error)); } catch {}
  },
};

export default log;
