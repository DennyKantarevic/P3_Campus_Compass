import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

describe('static UI markup', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const mainJs = fs.readFileSync('src/main.js', 'utf8');
  const routingServiceJs = fs.readFileSync('src/routingService.js', 'utf8');

  it('does not render a Gators logo or badge', () => {
    assert.doesNotMatch(html, /gators-logo/);
    assert.doesNotMatch(html, /gators-badge/);
    assert.equal(fs.existsSync('public/assets/gators-football-logo.svg'), false);
  });

  it('keeps the map on the default OpenStreetMap tile style', () => {
    assert.match(mainJs, /tile\.openstreetmap\.org/);
    assert.doesNotMatch(mainJs, /dark_all/);
  });

  it('does not require paid map API credentials', () => {
    const source = `${html}\n${mainJs}\n${routingServiceJs}`;
    const formerMapEnvVar = new RegExp(`VITE_${'GOO'}${'GLE'}`, 'i');
    const formerScriptHost = new RegExp(`maps\\.${'goo'}${'gle'}apis`, 'i');
    const formerMatrixService = new RegExp(`Distance\\s+${'Mat'}${'rix'}`, 'i');

    assert.doesNotMatch(source, formerMapEnvVar);
    assert.doesNotMatch(source, formerScriptHost);
    assert.doesNotMatch(source, formerMatrixService);
    assert.match(routingServiceJs, /routing\.openstreetmap\.de\/routed-foot/);
  });

  it('has explicit walk time and distance fields in the route panel', () => {
    assert.match(html, /id="routeWalkTime"/);
    assert.match(html, /id="routeDistance"/);
  });

  it('renders a finished UF-themed top bar without a Gators logo', () => {
    assert.match(html, /UF Campus Navigator/);
    assert.match(html, /Plan your walk between classes/);
    assert.match(html, /Walking Routes/);
    assert.match(html, /Class Gap Alerts/);
    assert.match(html, /Campus Planner/);
    assert.match(html, /id="currentDate"/);
  });

  it('includes a short UF-themed first-load screen', () => {
    assert.match(html, /id="loadingScreen"/);
    assert.match(html, /Loading your campus route/);
    assert.match(html, /Go Gators/);
    assert.match(mainJs, /hideLoadingScreen/);
    assert.match(mainJs, /MIN_LOADING_SCREEN_MS = 2400/);
  });

  it('clears old route metrics before resolving a new route state', () => {
    assert.ok(
      mainJs.indexOf('setRouteMetrics(null);') < mainJs.indexOf('if (start === destination)'),
      'Route metrics should be reset before any route branch can render or fail.',
    );
  });
});
