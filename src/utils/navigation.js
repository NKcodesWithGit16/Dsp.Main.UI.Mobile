// Geo helpers for turn-by-turn navigation.
// All inputs/outputs use the React Native maps convention: { latitude, longitude }.

const R_METERS = 6_371_000;

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }

export function haversineMeters(a, b) {
  if (!a || !b) return Infinity;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_METERS * Math.asin(Math.sqrt(h));
}

// Initial bearing from p1 to p2, in degrees [0, 360).
export function bearingDeg(p1, p2) {
  if (!p1 || !p2) return 0;
  const lat1 = toRad(p1.latitude);
  const lat2 = toRad(p2.latitude);
  const dLng = toRad(p2.longitude - p1.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
          - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Approximate distance from point P to segment AB in meters,
// projecting in local equirectangular coords around A.
export function distanceToSegmentMeters(p, a, b) {
  if (!p || !a || !b) return Infinity;
  const meterPerLat = 111_320;
  const meterPerLng = 111_320 * Math.cos(toRad(a.latitude));
  const ax = 0, ay = 0;
  const bx = (b.longitude - a.longitude) * meterPerLng;
  const by = (b.latitude  - a.latitude)  * meterPerLat;
  const px = (p.longitude - a.longitude) * meterPerLng;
  const py = (p.latitude  - a.latitude)  * meterPerLat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Min distance from `p` to any segment of the encoded route `coords`.
export function distanceToRouteMeters(p, coords) {
  if (!p || !coords?.length) return Infinity;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = distanceToSegmentMeters(p, coords[i], coords[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

// Projects `p` onto the nearest segment of `coords`. Returns the snapped
// point, the index of the segment it landed on, the distance from p to the
// segment, and the bearing of that segment — useful for tight camera-follow
// that hides GPS jitter while staying on-route.
export function nearestPointOnRoute(p, coords) {
  if (!p || !coords?.length || coords.length < 2) return null;
  const meterPerLat = 111_320;
  const meterPerLng = 111_320 * Math.cos(toRad(p.latitude));
  let best = { distance: Infinity, point: p, index: 0, bearing: 0 };

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const ax = (a.longitude - p.longitude) * meterPerLng;
    const ay = (a.latitude  - p.latitude)  * meterPerLat;
    const bx = (b.longitude - p.longitude) * meterPerLng;
    const by = (b.latitude  - p.latitude)  * meterPerLat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(cx, cy);
    if (d < best.distance) {
      best = {
        distance: d,
        point: {
          latitude: a.latitude + (b.latitude - a.latitude) * t,
          longitude: a.longitude + (b.longitude - a.longitude) * t,
        },
        index: i,
        bearing: bearingDeg(a, b),
      };
    }
  }
  return best;
}

// Returns true when the driver appears to have crossed past `target`.
// We treat them as "past" when they're within 30m of it OR when the bearing
// from target to driver flips relative to the bearing from prevTarget to target
// (meaning they've moved beyond).
export function hasReachedPoint(driverPos, target, threshold = 30) {
  return haversineMeters(driverPos, target) <= threshold;
}

// Given the route's `steps[]` and a starting `currentStepIndex`, returns the
// index of the step the driver is currently inside, advancing past any
// already-completed steps. Cheap to call on every GPS update.
export function advanceStepIndex(steps, currentIndex, driverPos) {
  if (!steps?.length || !driverPos) return currentIndex;
  let i = Math.max(0, Math.min(currentIndex, steps.length - 1));
  // Advance past any step whose end is within reach (we've crossed the maneuver).
  while (i < steps.length - 1 && hasReachedPoint(driverPos, steps[i].endLocation, 30)) {
    i += 1;
  }
  return i;
}

// Friendly formatting for the HUD.
export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '';
  const feet = meters * 3.28084;
  if (feet < 1000) {
    // Round to nearest 50 ft for readability.
    const rounded = Math.max(50, Math.round(feet / 50) * 50);
    return `${rounded} ft`;
  }
  const miles = meters / 1609.34;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// Maps Google's maneuver string to a glyph for the HUD.
export function maneuverGlyph(maneuver) {
  switch (maneuver) {
    case 'turn-left':            return '↰';
    case 'turn-right':           return '↱';
    case 'turn-slight-left':     return '↖';
    case 'turn-slight-right':    return '↗';
    case 'turn-sharp-left':      return '⬉';
    case 'turn-sharp-right':     return '⬈';
    case 'uturn-left':
    case 'uturn-right':          return '⤺';
    case 'roundabout-left':
    case 'roundabout-right':     return '⟳';
    case 'merge':                return '⤳';
    case 'fork-left':
    case 'fork-right':           return '⤙';
    case 'ramp-left':
    case 'ramp-right':           return '↑';
    case 'keep-left':            return '↖';
    case 'keep-right':           return '↗';
    case 'straight':             return '↑';
    default:                     return '↑';
  }
}
