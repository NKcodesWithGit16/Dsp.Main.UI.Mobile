/**
 * Compute a 0–100 match score between a driver and a load. Higher = better.
 *
 *   • Equipment match           (40 pts)  — exact equipment string match
 *   • Availability              (30 pts)  — idle = full, moving = partial,
 *                                            offline = 0
 *   • Geographic proximity      (30 pts)  — based on driver lat/lng vs.
 *                                            load origin coords. Lacking
 *                                            coords on either side falls
 *                                            back to a neutral 15.
 */
function statusOf(d) {
  if (typeof d.status === 'number') return ['moving', 'idle', 'offline'][d.status] ?? 'offline';
  return (d.status || 'offline').toLowerCase();
}

function haversineMiles(a, b) {
  if (!a || !b) return null;
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function loadMatchScore(driver, load) {
  if (!driver || !load) return 0;
  let score = 0;

  // Equipment (40)
  if (driver.equipment && load.equipment && driver.equipment.toLowerCase() === load.equipment.toLowerCase()) {
    score += 40;
  } else if (!driver.equipment) {
    score += 20; // unknown equipment — partial credit
  }

  // Availability (30)
  const status = statusOf(driver);
  if (status === 'idle') score += 30;
  else if (status === 'moving') score += 10;

  // Proximity (30)
  const driverLatLng = driver.lat != null && driver.lng != null
    ? { lat: driver.lat, lng: driver.lng }
    : null;
  const loadLatLng = (load.pickupLat ?? load.originLat) != null && (load.pickupLng ?? load.originLng) != null
    ? { lat: load.pickupLat ?? load.originLat, lng: load.pickupLng ?? load.originLng }
    : null;
  if (driverLatLng && loadLatLng) {
    const miles = haversineMiles(driverLatLng, loadLatLng);
    if (miles == null) score += 15;
    else if (miles < 25)  score += 30;
    else if (miles < 100) score += 22;
    else if (miles < 300) score += 14;
    else if (miles < 700) score += 6;
  } else {
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
}

export function bestDriverForLoad(drivers, load) {
  if (!drivers?.length || !load) return null;
  let best = null;
  let bestScore = -1;
  for (const d of drivers) {
    const s = loadMatchScore(d, load);
    if (s > bestScore) {
      best = d;
      bestScore = s;
    }
  }
  return best ? { driver: best, score: bestScore } : null;
}
