// Google Directions client + polyline decoder. Returns an array of
// { latitude, longitude } points suitable for <Polyline />.

import Constants from 'expo-constants';

const API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  Constants?.expoConfig?.android?.config?.googleMapsApiKey ||
  Constants?.expoConfig?.ios?.config?.googleMapsApiKey ||
  '';

// Google's standard encoded polyline → coordinate list.
export function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

/**
 * Fetches a road-following polyline between origin → (optional waypoint) → destination.
 * `origin`, `waypoint`, `destination` are { latitude, longitude }.
 * Returns { coords, steps, distanceMeters, durationSeconds } or null on failure.
 * Each step: { instruction, maneuver, distanceMeters, durationSeconds, startLocation, endLocation, coords }.
 */
export async function fetchRoute({ origin, waypoint, destination }) {
  if (!API_KEY || !origin || !destination) return null;
  const params = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    key: API_KEY,
    mode: 'driving',
  });
  if (waypoint) {
    params.set('waypoints', `${waypoint.latitude},${waypoint.longitude}`);
  }

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) return null;
    const route = data.routes[0];

    // Build the route polyline from each step's per-step polyline instead of
    // route.overview_polyline. The overview is a lossy simplification that
    // drops points and visibly cuts corners off the road; the per-step
    // polylines are full-fidelity and hug the actual road geometry.
    const coords = [];
    const allSteps = [];
    let aggregateDistance = 0;
    let aggregateDuration = 0;
    for (const leg of route.legs || []) {
      aggregateDistance += leg.distance?.value || 0;
      aggregateDuration += leg.duration?.value || 0;
      for (const step of leg.steps || []) {
        const stepCoords = decodePolyline(step.polyline?.points || '');
        // Skip the first point of each subsequent step — it duplicates the
        // last point of the previous step.
        if (coords.length > 0 && stepCoords.length > 0) stepCoords.shift();
        for (const c of stepCoords) coords.push(c);

        allSteps.push({
          instruction: stripHtml(step.html_instructions || ''),
          maneuver: step.maneuver || null,
          distanceMeters: step.distance?.value || 0,
          durationSeconds: step.duration?.value || 0,
          startLocation: {
            latitude: step.start_location?.lat,
            longitude: step.start_location?.lng,
          },
          endLocation: {
            latitude: step.end_location?.lat,
            longitude: step.end_location?.lng,
          },
          coords: decodePolyline(step.polyline?.points || ''),
        });
      }
    }

    return {
      coords,
      steps: allSteps,
      distanceMeters: aggregateDistance,
      durationSeconds: aggregateDuration,
    };
  } catch {
    return null;
  }
}

function stripHtml(html) {
  return html
    .replace(/<div[^>]*>/gi, ' — ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
