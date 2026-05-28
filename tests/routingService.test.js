import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOsrmRouteUrl,
  fetchPedestrianRoute,
  formatDuration,
  normalizeOsrmRoute,
} from '../src/routingService.js';

describe('routing service helpers', () => {
  it('builds a routed-foot OSRM URL without API credentials', () => {
    const url = buildOsrmRouteUrl(
      [29.6432, -82.3554],
      [29.6506, -82.3439],
    );

    assert.equal(
      url,
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot/-82.3554,29.6432;-82.3439,29.6506?overview=full&geometries=geojson&steps=true',
    );
  });

  it('normalizes OSRM GeoJSON geometry, distance, duration, and steps', () => {
    const route = normalizeOsrmRoute({
      code: 'Ok',
      routes: [{
        geometry: {
          type: 'LineString',
          coordinates: [
            [-82.3554, 29.6432],
            [-82.3549, 29.6441],
            [-82.3439, 29.6506],
          ],
        },
        distance: 1200,
        duration: 900,
        legs: [{
          steps: [{
            name: 'Stadium Road',
            distance: 80,
            duration: 60,
            maneuver: { type: 'turn', modifier: 'right' },
          }],
        }],
      }],
    });

    assert.deepEqual(route.coordinates, [
      [29.6432, -82.3554],
      [29.6441, -82.3549],
      [29.6506, -82.3439],
    ]);
    assert.equal(route.distanceMeters, 1200);
    assert.equal(route.durationSeconds, 900);
    assert.deepEqual(route.steps, [{
      name: 'Stadium Road',
      distanceMeters: 80,
      durationSeconds: 60,
    }]);
  });

  it('requests an OSRM route for route geometry and duration', async () => {
    const requestedUrls = [];
    const osrmResponse = {
      code: 'Ok',
      routes: [{
        geometry: {
          type: 'LineString',
          coordinates: [
            [-82.3554, 29.6432],
            [-82.3439, 29.6506],
          ],
        },
        distance: 1200,
        duration: 720,
        legs: [{ steps: [] }],
      }],
    };
    const fetchImpl = async (url) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => osrmResponse,
      };
    };

    const route = await fetchPedestrianRoute(
      [29.6432, -82.3554],
      [29.6506, -82.3439],
      fetchImpl,
    );

    assert.equal(
      requestedUrls[0],
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot/-82.3554,29.6432;-82.3439,29.6506?overview=full&geometries=geojson&steps=true',
    );
    assert.equal(route.durationSeconds, 720);
  });

  it('formats a same-building route as zero minutes', () => {
    assert.equal(formatDuration(0), '0 min');
  });

  it('reports a clear error when OSRM cannot produce a route', () => {
    assert.throws(
      () => normalizeOsrmRoute({ code: 'NoRoute', routes: [] }),
      /OSRM could not find a route/,
    );
  });
});
