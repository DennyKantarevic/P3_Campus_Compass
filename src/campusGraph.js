export function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  values.push(value.trim());
  return values;
}

export function buildCampusGraph(edgeRows) {
  const locations = new Map();
  const adjacency = new Map();
  const edges = [];

  for (const row of edgeRows) {
    const from = Number(row.LocationID_1);
    const to = Number(row.LocationID_2);
    const weight = Number(row.Time);

    if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(weight)) {
      continue;
    }

    locations.set(from, { id: from, name: row.Name_1 });
    locations.set(to, { id: to, name: row.Name_2 });
    addDirectedEdge(adjacency, from, to, weight);
    addDirectedEdge(adjacency, to, from, weight);
    edges.push({ from, to, weight, fromName: row.Name_1, toName: row.Name_2 });
  }

  return { locations, adjacency, edges };
}

function addDirectedEdge(adjacency, from, to, weight) {
  if (!adjacency.has(from)) {
    adjacency.set(from, []);
  }
  adjacency.get(from).push({ to, weight });
}

export function normalizeClasses(classRows) {
  return classRows
    .map((row) => ({
      code: row.ClassCode,
      locationId: Number(row.LocationID),
      startTime: row['Start Time (HH:MM)'],
      endTime: row['End Time (HH:MM)'],
    }))
    .filter((course) => course.code && Number.isFinite(course.locationId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.code.localeCompare(b.code));
}

export function shortestPath(graph, startId, destinationId) {
  const start = Number(startId);
  const destination = Number(destinationId);

  if (!Number.isFinite(start) || !Number.isFinite(destination)) {
    return { distance: Infinity, path: [] };
  }

  if (start === destination) {
    return { distance: 0, path: [start] };
  }

  const distances = new Map([[start, 0]]);
  const previous = new Map();
  const queue = [{ node: start, distance: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();

    if (current.distance > (distances.get(current.node) ?? Infinity)) {
      continue;
    }

    if (current.node === destination) {
      break;
    }

    for (const edge of graph.adjacency.get(current.node) ?? []) {
      const nextDistance = current.distance + edge.weight;
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance);
        previous.set(edge.to, current.node);
        queue.push({ node: edge.to, distance: nextDistance });
      }
    }
  }

  if (!distances.has(destination)) {
    return { distance: Infinity, path: [] };
  }

  const path = [];
  for (let node = destination; node !== undefined; node = previous.get(node)) {
    path.push(node);
    if (node === start) {
      break;
    }
  }

  path.reverse();
  return { distance: distances.get(destination), path };
}

export function getEdgeWeight(graph, from, to) {
  return graph.adjacency.get(from)?.find((edge) => edge.to === to)?.weight ?? null;
}

export function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) {
    return 'No route';
  }
  if (minutes === 1) {
    return '1 min';
  }
  return `${minutes} min`;
}
