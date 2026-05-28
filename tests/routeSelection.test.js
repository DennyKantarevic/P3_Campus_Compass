import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getNextMarkerSelection } from '../src/routeSelection.js';

describe('marker click route selection', () => {
  it('uses the first marker click as start and arms destination for the next click', () => {
    assert.deepEqual(getNextMarkerSelection('start', 1), {
      updates: { startId: '1' },
      nextTarget: 'destination',
    });
  });

  it('uses the second marker click as destination and arms start for a new route', () => {
    assert.deepEqual(getNextMarkerSelection('destination', 14), {
      updates: { destinationId: '14' },
      nextTarget: 'start',
    });
  });
});
