import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import {
  buildCampusGraph,
  normalizeClasses,
  parseCsv,
} from './campusGraph.js';
import { CAMPUS_COORDINATES, UF_CENTER } from './campusLocations.js';
import {
  fetchPedestrianRoute,
  formatDistance,
  formatDuration,
} from './routingService.js';
import {
  getTravelCautions,
  timeToMinutes,
  validateScheduleItem,
} from './schedule.js';
import { getNextMarkerSelection } from './routeSelection.js';

const els = {
  loadingScreen: document.querySelector('#loadingScreen'),
  map: document.querySelector('#map'),
  statusBanner: document.querySelector('#statusBanner'),
  currentDate: document.querySelector('#currentDate'),
  currentTime: document.querySelector('#currentTime'),
  startSelect: document.querySelector('#startSelect'),
  destinationSelect: document.querySelector('#destinationSelect'),
  swapRoute: document.querySelector('#swapRoute'),
  resetView: document.querySelector('#resetView'),
  routeSummary: document.querySelector('#routeSummary'),
  routeWalkTime: document.querySelector('#routeWalkTime'),
  routeDistance: document.querySelector('#routeDistance'),
  routeSteps: document.querySelector('#routeSteps'),
  classSelect: document.querySelector('#classSelect'),
  addClass: document.querySelector('#addClass'),
  eventTitle: document.querySelector('#eventTitle'),
  eventLocation: document.querySelector('#eventLocation'),
  eventStart: document.querySelector('#eventStart'),
  eventEnd: document.querySelector('#eventEnd'),
  addEvent: document.querySelector('#addEvent'),
  clearSchedule: document.querySelector('#clearSchedule'),
  scheduleWarning: document.querySelector('#scheduleWarning'),
  nextEvent: document.querySelector('#nextEvent'),
  scheduleList: document.querySelector('#scheduleList'),
};

const loadingStartedAt = performance.now();
const MIN_LOADING_SCREEN_MS = 2400;

const state = {
  graph: null,
  courses: [],
  schedule: [],
  activeScheduleId: null,
  routeRequestId: 0,
  map: null,
  edgeLayer: null,
  markerLayer: null,
  routeLayer: null,
  locationMarkers: new Map(),
};

init().then(hideLoadingScreen).catch((error) => {
  showStatus(error.message);
  hideLoadingScreen();
});

async function init() {
  state.map = createMap();
  const [edgeRows, classRows] = await loadCampusData();
  state.graph = buildCampusGraph(edgeRows);
  state.courses = normalizeClasses(classRows);

  populateLocationSelects();
  populateClassSelect();
  drawCampusNetwork();
  bindControls();
  updateClock();
  setInterval(updateClock, 1000);
  await updateRoute({ fit: true });
}

function createMap() {
  const map = L.map(els.map, {
    zoomControl: false,
    minZoom: 14,
    maxZoom: 19,
  }).setView(UF_CENTER, 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.scale({ position: 'bottomleft', imperial: true, metric: false }).addTo(map);

  state.edgeLayer = L.layerGroup().addTo(map);
  state.markerLayer = L.layerGroup().addTo(map);
  state.routeLayer = L.layerGroup().addTo(map);
  return map;
}

async function loadCampusData() {
  const base = import.meta.env.BASE_URL;
  const [edgesResponse, classesResponse] = await Promise.all([
    fetch(`${base}data/edges.csv`),
    fetch(`${base}data/classes.csv`),
  ]);

  if (!edgesResponse.ok || !classesResponse.ok) {
    throw new Error('Campus data files could not be loaded.');
  }

  const [edgesCsv, classesCsv] = await Promise.all([
    edgesResponse.text(),
    classesResponse.text(),
  ]);

  return [parseCsv(edgesCsv), parseCsv(classesCsv)];
}

function populateLocationSelects() {
  const locations = sortedLocations();
  for (const select of [els.startSelect, els.destinationSelect, els.eventLocation]) {
    select.replaceChildren();
    for (const location of locations) {
      select.append(createOption(location.id, location.name));
    }
  }

  els.startSelect.value = '1';
  els.destinationSelect.value = '14';
  els.eventLocation.value = '12';
}

function populateClassSelect() {
  els.classSelect.replaceChildren();
  for (const course of state.courses) {
    const location = state.graph.locations.get(course.locationId);
    const label = `${course.code} | ${course.startTime}-${course.endTime} | ${location?.name ?? 'Campus'}`;
    els.classSelect.append(createOption(course.code, label));
  }
}

function sortedLocations() {
  return [...state.graph.locations.values()]
    .filter((location) => CAMPUS_COORDINATES[location.id])
    .sort((a, b) => a.name.localeCompare(b.name));
}

function createOption(value, label) {
  const option = document.createElement('option');
  option.value = String(value);
  option.textContent = label;
  return option;
}

function drawCampusNetwork() {
  state.edgeLayer.clearLayers();
  state.markerLayer.clearLayers();
  state.locationMarkers.clear();

  for (const location of sortedLocations()) {
    const marker = L.circleMarker(CAMPUS_COORDINATES[location.id], {
      radius: 6,
      color: '#ffffff',
      weight: 2.5,
      fillColor: '#0021a5',
      fillOpacity: 0.95,
    })
      .bindTooltip(location.name, { direction: 'top', offset: [0, -8] })
      .on('click', () => selectLocationFromMarker(location.id))
      .addTo(state.markerLayer);

    state.locationMarkers.set(location.id, marker);
  }
}

function bindControls() {
  els.startSelect.addEventListener('change', () => {
    void updateRoute({ fit: true });
  });
  els.destinationSelect.addEventListener('change', () => {
    void updateRoute({ fit: true });
  });
  els.swapRoute.addEventListener('click', () => {
    const start = els.startSelect.value;
    els.startSelect.value = els.destinationSelect.value;
    els.destinationSelect.value = start;
    void updateRoute({ fit: true });
  });
  els.resetView.addEventListener('click', () => state.map.setView(UF_CENTER, 16));
  els.addClass.addEventListener('click', () => {
    void addSelectedClass();
  });
  els.addEvent.addEventListener('click', () => {
    void addCustomEvent();
  });
  els.clearSchedule.addEventListener('click', () => {
    state.schedule = [];
    state.activeScheduleId = null;
    clearScheduleWarning();
    renderSchedule();
  });
}

function selectLocationFromMarker(locationId) {
  const selection = getNextMarkerSelection(getMarkerTarget(), locationId);
  if (selection.updates.startId) {
    els.startSelect.value = selection.updates.startId;
  }
  if (selection.updates.destinationId) {
    els.destinationSelect.value = selection.updates.destinationId;
  }
  setMarkerTarget(selection.nextTarget);
  void updateRoute({ fit: true });
}

function getMarkerTarget() {
  return document.querySelector('input[name="markerTarget"]:checked')?.value ?? 'start';
}

function setMarkerTarget(target) {
  const input = document.querySelector(`input[name="markerTarget"][value="${target}"]`);
  if (input) {
    input.checked = true;
  }
}

async function updateRoute({ fit = false } = {}) {
  const requestId = ++state.routeRequestId;
  state.routeLayer.clearLayers();
  const start = Number(els.startSelect.value);
  const destination = Number(els.destinationSelect.value);

  highlightEndpointMarkers(start, destination);
  els.routeSteps.replaceChildren();
  setRouteMetrics(null);

  if (start === destination) {
    renderRouteSummary({ start, destination, distanceMeters: 0, durationSeconds: 0 });
    return;
  }

  const startCoordinates = CAMPUS_COORDINATES[start];
  const destinationCoordinates = CAMPUS_COORDINATES[destination];
  if (!startCoordinates || !destinationCoordinates) {
    els.routeSummary.textContent = 'Route coordinates are missing for one of those locations.';
    return;
  }

  els.routeSummary.textContent = 'Finding OpenStreetMap walking route...';

  try {
    const route = await fetchPedestrianRoute(startCoordinates, destinationCoordinates);
    if (requestId !== state.routeRequestId) {
      return;
    }

    renderRouteSummary({ ...route, start, destination });
    renderRouteSteps(route);
    drawRouteLine(route.coordinates, fit);
  } catch (error) {
    if (requestId !== state.routeRequestId) {
      return;
    }
    els.routeSummary.textContent = `${error.message} Try another campus location pair.`;
    setRouteMetrics(null);
  }
}

function drawRouteLine(coordinates, fit) {
  L.polyline(coordinates, {
    color: '#0021a5',
    weight: 11,
    opacity: 0.55,
    lineCap: 'round',
  }).addTo(state.routeLayer);

  const routeLine = L.polyline(coordinates, {
    color: '#fa4616',
    weight: 6.5,
    opacity: 0.96,
    lineCap: 'round',
  }).addTo(state.routeLayer);

  if (fit) {
    state.map.fitBounds(routeLine.getBounds().pad(0.22), {
      animate: true,
      maxZoom: 17,
    });
  }
}

function renderRouteSummary(result) {
  const { start, destination } = result;
  const startName = state.graph.locations.get(start)?.name ?? 'Start';
  const destinationName = state.graph.locations.get(destination)?.name ?? 'Destination';

  els.routeSummary.textContent =
    `${startName} to ${destinationName}`;
  setRouteMetrics(result);
}

function setRouteMetrics(route) {
  if (!route || !Number.isFinite(route.durationSeconds) || !Number.isFinite(route.distanceMeters)) {
    els.routeWalkTime.textContent = '--';
    els.routeDistance.textContent = '--';
    return;
  }

  els.routeWalkTime.textContent = formatDuration(route.durationSeconds);
  els.routeDistance.textContent = formatDistance(route.distanceMeters);
}

function renderRouteSteps(route) {
  els.routeSteps.replaceChildren();

  if (!route.steps.length) {
    const item = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = 'Follow highlighted OpenStreetMap walking route';
    const label = document.createElement('strong');
    label.textContent = 'Route';
    item.append(title, label);
    els.routeSteps.append(item);
    return;
  }

  for (const step of route.steps.slice(0, 10)) {
    const item = document.createElement('li');
    const title = document.createElement('span');
    title.textContent = step.name;
    const distance = document.createElement('strong');
    distance.textContent = formatDistance(step.distanceMeters);
    const duration = document.createElement('span');
    duration.textContent = formatDuration(step.durationSeconds);
    item.append(title, distance, duration);
    els.routeSteps.append(item);
  }
}

function highlightEndpointMarkers(start, destination) {
  for (const [id, marker] of state.locationMarkers) {
    if (id === start) {
      marker.setStyle({ fillColor: '#0021a5', color: '#fa4616', radius: 8, weight: 3.5 });
    } else if (id === destination) {
      marker.setStyle({ fillColor: '#0021a5', color: '#fa4616', radius: 8, weight: 3.5 });
    } else {
      marker.setStyle({ fillColor: '#0021a5', color: '#ffffff', radius: 6, weight: 2.5 });
    }
  }
}

async function addSelectedClass() {
  const course = state.courses.find((item) => item.code === els.classSelect.value);
  if (!course) {
    return;
  }

  await addScheduleItem({
    id: `class-${course.code}`,
    title: course.code,
    locationId: course.locationId,
    startTime: course.startTime,
    endTime: course.endTime,
    kind: 'Class',
  });
}

async function addCustomEvent() {
  const title = els.eventTitle.value.trim() || 'Campus event';
  const locationId = Number(els.eventLocation.value);
  const startTime = els.eventStart.value;
  const endTime = els.eventEnd.value || startTime;

  await addScheduleItem({
    id: `event-${Date.now()}`,
    title,
    locationId,
    startTime,
    endTime,
    kind: 'Event',
  });

  els.eventTitle.value = '';
}

async function addScheduleItem(item) {
  const validation = validateScheduleItem(item, state.schedule);
  if (!validation.valid) {
    showScheduleWarning(validation.message, 'error');
    return false;
  }

  const itemWithCautions = { ...item, cautions: [] };
  try {
    itemWithCautions.cautions = await getTravelCautions(item, state.schedule, getWalkingRouteBetweenLocations);
  } catch (error) {
    itemWithCautions.cautions = [{
      message: `Caution: OpenStreetMap walking time could not be checked. ${error.message}`,
    }];
  }

  state.schedule.push(item);
  Object.assign(state.schedule[state.schedule.length - 1], itemWithCautions);
  state.activeScheduleId = item.id;
  if (itemWithCautions.cautions.length) {
    showScheduleWarning(itemWithCautions.cautions[0].message, 'caution');
  } else {
    clearScheduleWarning();
  }
  renderSchedule();
  return true;
}

async function getWalkingRouteBetweenLocations(fromLocationId, toLocationId) {
  const from = CAMPUS_COORDINATES[fromLocationId];
  const to = CAMPUS_COORDINATES[toLocationId];

  if (!from || !to) {
    throw new Error('Coordinates are missing for one of the scheduled locations.');
  }

  return fetchPedestrianRoute(from, to);
}

function renderSchedule() {
  state.schedule.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  els.scheduleList.replaceChildren();

  for (const item of state.schedule) {
    const location = state.graph.locations.get(item.locationId);
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `schedule-item${item.id === state.activeScheduleId ? ' is-active' : ''}`;
    button.addEventListener('click', () => {
      state.activeScheduleId = item.id;
      els.destinationSelect.value = String(item.locationId);
      renderSchedule();
      void updateRoute({ fit: true });
    });

    const title = document.createElement('strong');
    title.textContent = item.title;
    const meta = document.createElement('span');
    meta.textContent = `${item.startTime}-${item.endTime} | ${location?.name ?? 'Campus'}`;
    const tag = document.createElement('small');
    tag.textContent = item.kind;

    button.append(title, meta, tag);
    if (item.cautions?.length) {
      const caution = document.createElement('span');
      caution.className = 'item-caution';
      caution.textContent = item.cautions[0].message;
      button.append(caution);
    }
    row.append(button);
    els.scheduleList.append(row);
  }

  updateClock();
}

function updateClock() {
  const now = new Date();
  els.currentDate.textContent = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  els.currentTime.textContent = now.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const next = state.schedule
    .filter((item) => timeToMinutes(item.startTime) >= currentMinutes)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0];

  if (!state.schedule.length) {
    els.nextEvent.textContent = 'No scheduled events.';
  } else if (next) {
    const location = state.graph.locations.get(next.locationId);
    els.nextEvent.textContent = `Next: ${next.title} at ${next.startTime} | ${location?.name ?? 'Campus'}`;
  } else {
    els.nextEvent.textContent = 'Schedule complete for today.';
  }
}

function showStatus(message) {
  els.statusBanner.hidden = false;
  els.statusBanner.textContent = message;
}

function showScheduleWarning(message, tone = 'error') {
  els.scheduleWarning.hidden = false;
  els.scheduleWarning.classList.toggle('is-caution', tone === 'caution');
  els.scheduleWarning.textContent = message;
}

function clearScheduleWarning() {
  els.scheduleWarning.hidden = true;
  els.scheduleWarning.classList.remove('is-caution');
  els.scheduleWarning.textContent = '';
}

function hideLoadingScreen() {
  const elapsed = performance.now() - loadingStartedAt;
  const delay = Math.max(0, MIN_LOADING_SCREEN_MS - elapsed);

  window.setTimeout(() => {
    els.loadingScreen.classList.add('is-hidden');
    window.setTimeout(() => {
      els.loadingScreen.hidden = true;
    }, 320);
  }, delay);
}
