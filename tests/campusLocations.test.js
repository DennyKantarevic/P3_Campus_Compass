import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { buildCampusGraph, parseCsv } from '../src/campusGraph.js';
import { CAMPUS_COORDINATES } from '../src/campusLocations.js';

describe('campus marker locations', () => {
  it('has coordinates for every destination in the campus graph', () => {
    const edges = parseCsv(fs.readFileSync('public/data/edges.csv', 'utf8'));
    const graph = buildCampusGraph(edges);
    const missing = [...graph.locations.keys()].filter((id) => !CAMPUS_COORDINATES[id]);

    assert.deepEqual(missing, []);
  });

  it('uses OSM-aligned coordinates for prominent UF destinations', () => {
    assert.deepEqual(CAMPUS_COORDINATES[7], [29.64831, -82.34435]);
    assert.deepEqual(CAMPUS_COORDINATES[10], [29.65138, -82.34289]);
    assert.deepEqual(CAMPUS_COORDINATES[18], [29.64685, -82.33812]);
    assert.deepEqual(CAMPUS_COORDINATES[40], [29.64775, -82.3417]);
    assert.deepEqual(CAMPUS_COORDINATES[49], [29.64229, -82.34714]);
    assert.deepEqual(CAMPUS_COORDINATES[56], [29.6439, -82.34979]);
  });

  it('keeps all campus coordinates in Leaflet latitude-longitude order', () => {
    for (const [id, [lat, lon]] of Object.entries(CAMPUS_COORDINATES)) {
      assert.ok(lat > 29.63 && lat < 29.66, `Location ${id} latitude is outside UF campus bounds.`);
      assert.ok(lon > -82.37 && lon < -82.33, `Location ${id} longitude is outside UF campus bounds.`);
    }
  });
});
