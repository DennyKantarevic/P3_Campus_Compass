const OSRM_ROUTE_BASE_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

export function buildOsrmRouteUrl(startLatLng, destinationLatLng) {
  const start = toOsrmCoordinate(startLatLng);
  const destination = toOsrmCoordinate(destinationLatLng);
  const params = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
  });

  return `${OSRM_ROUTE_BASE_URL}/${start};${destination}?${params.toString()}`;
}

export async function fetchPedestrianRoute(startLatLng, destinationLatLng, fetchImpl = fetch) {
  const response = await fetchImpl(buildOsrmRouteUrl(startLatLng, destinationLatLng));

  if (!response.ok) {
    throw new Error(`OSRM routing request failed with status ${response.status}.`);
  }

  return normalizeOsrmRoute(await response.json());
}

export function normalizeOsrmRoute(payload) {
  if (payload?.code && payload.code !== 'Ok') {
    throw new Error(`OSRM could not find a route (${payload.code}).`);
  }

  const route = payload?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;

  if (!route || !Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error('OSRM could not find a walking route for those locations.');
  }

  return {
    coordinates: coordinates.map(toLeafletLatLng),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps: normalizeSteps(route.legs?.[0]?.steps ?? []),
  };
}

function toOsrmCoordinate([lat, lng]) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Route coordinates must be valid latitude and longitude values.');
  }

  return `${lng},${lat}`;
}

function toLeafletLatLng([lng, lat]) {
  return [lat, lng];
}

function normalizeSteps(steps) {
  return steps
    .filter((step) => Number.isFinite(step.distance) && Number.isFinite(step.duration))
    .map((step) => ({
      name: getStepName(step),
      distanceMeters: step.distance,
      durationSeconds: step.duration,
    }));
}

function getStepName(step) {
  if (step.name) {
    return step.name;
  }

  const maneuver = [step.maneuver?.modifier, step.maneuver?.type]
    .filter(Boolean)
    .join(' ');

  return maneuver || 'campus walking path';
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) {
    return '';
  }

  return `${(meters / 1609.344).toFixed(1)} miles`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return '';
  }

  if (seconds <= 0) {
    return '0 min';
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? '1 min' : `${minutes} min`;
}

export function durationSecondsToMinutes(seconds) {
  return Math.max(1, Math.ceil(seconds / 60));
}
