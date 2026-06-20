const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const normalizePoint = (point) => {
  if (!point) return null;

  if (typeof point.lat === 'function' && typeof point.lng === 'function') {
    const lat = Number(point.lat());
    const lng = Number(point.lng());
    return isFiniteCoordinate(lat) && isFiniteCoordinate(lng) ? { lat, lng } : null;
  }

  const lat = Number(point.lat);
  const lng = Number(point.lng);
  return isFiniteCoordinate(lat) && isFiniteCoordinate(lng) ? { lat, lng } : null;
};

const normalizeIntermediate = (waypoint) => {
  if (!waypoint) return null;
  if (typeof waypoint === 'string') {
    const location = waypoint.trim();
    return location ? { location } : null;
  }
  if (typeof waypoint === 'object' && waypoint.location) {
    return waypoint;
  }

  const location = normalizePoint(waypoint);
  return location ? { location } : null;
};

const parseDurationSeconds = (value) => {
  if (Number.isFinite(Number(value))) {
    return Number(value);
  }

  const match = /^([\d.]+)s$/i.exec(String(value || '').trim());
  return match ? Number(match[1]) : 0;
};

export const sumComputedRouteLegs = (legs = []) =>
  (Array.isArray(legs) ? legs : []).reduce(
    (totals, leg) => ({
      distanceMeters: totals.distanceMeters + Number(leg?.distanceMeters || 0),
      durationSeconds: totals.durationSeconds + parseDurationSeconds(leg?.duration),
    }),
    { distanceMeters: 0, durationSeconds: 0 },
  );

export const computeDrivingRoute = async ({
  origin,
  destination,
  intermediates = [],
  region,
  computeAlternativeRoutes = false,
} = {}) => {
  if (!window.google?.maps?.importLibrary) {
    return { status: 'LIBRARY_UNAVAILABLE', path: [], legs: [], route: null };
  }

  try {
    const { Route } = await window.google.maps.importLibrary('routes');
    const request = {
      origin,
      destination,
      travelMode: 'DRIVING',
      computeAlternativeRoutes,
      fields: ['path', 'legs'],
    };

    const normalizedIntermediates = (Array.isArray(intermediates) ? intermediates : [])
      .map(normalizeIntermediate)
      .filter(Boolean);
    if (normalizedIntermediates.length) {
      request.intermediates = normalizedIntermediates;
    }

    if (region) {
      request.region = String(region).trim().toLowerCase();
    }

    const result = await Route.computeRoutes(request);
    const route = result?.routes?.[0] || null;
    const path = (Array.isArray(route?.path) ? route.path : [])
      .map(normalizePoint)
      .filter(Boolean);

    return {
      status: route ? 'OK' : 'ZERO_RESULTS',
      path,
      legs: Array.isArray(route?.legs) ? route.legs : [],
      route,
    };
  } catch (error) {
    return {
      status: error?.message || 'ROUTE_COMPUTE_FAILED',
      path: [],
      legs: [],
      route: null,
    };
  }
};
