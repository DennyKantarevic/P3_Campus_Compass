export function getNextMarkerSelection(currentTarget, clickedLocationId) {
  if (currentTarget === 'destination') {
    return {
      updates: { destinationId: String(clickedLocationId) },
      nextTarget: 'start',
    };
  }

  return {
    updates: { startId: String(clickedLocationId) },
    nextTarget: 'destination',
  };
}
