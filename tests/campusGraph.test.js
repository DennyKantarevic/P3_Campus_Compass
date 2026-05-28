import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCampusGraph,
  parseCsv,
  shortestPath,
} from '../src/campusGraph.js';

describe('campus graph data utilities', () => {
  it('parses quoted CSV values and trims fields', () => {
    const rows = parseCsv('id,name,time\n1,"Library, West", 09:35\n');

    assert.deepEqual(rows, [
      { id: '1', name: 'Library, West', time: '09:35' },
    ]);
  });

  it('builds an undirected weighted graph from edge rows', () => {
    const graph = buildCampusGraph([
      {
        LocationID_1: '1',
        LocationID_2: '2',
        Name_1: 'Hume Hall',
        Name_2: 'Graham Hall',
        Time: '3',
      },
    ]);

    assert.equal(graph.locations.get(1).name, 'Hume Hall');
    assert.equal(graph.locations.get(2).name, 'Graham Hall');
    assert.deepEqual(graph.adjacency.get(1), [{ to: 2, weight: 3 }]);
    assert.deepEqual(graph.adjacency.get(2), [{ to: 1, weight: 3 }]);
  });

  it('finds the lowest travel-time route through campus paths', () => {
    const graph = {
      adjacency: new Map([
        [1, [{ to: 2, weight: 4 }, { to: 3, weight: 1 }]],
        [2, [{ to: 4, weight: 1 }]],
        [3, [{ to: 2, weight: 1 }, { to: 4, weight: 8 }]],
        [4, []],
      ]),
    };

    assert.deepEqual(shortestPath(graph, 1, 4), {
      distance: 3,
      path: [1, 3, 2, 4],
    });
  });
});
