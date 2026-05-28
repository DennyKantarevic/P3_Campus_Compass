export function validateScheduleItem(item, existingItems) {
  if (!item.title.trim()) {
    return { valid: false, message: 'Title is required.' };
  }

  if (!item.locationId) {
    return { valid: false, message: 'Location is required.' };
  }

  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { valid: false, message: 'Start and end times are required.' };
  }

  if (end <= start) {
    return { valid: false, message: 'End time must be after start time.' };
  }

  const conflict = findScheduleConflict(item, existingItems);
  if (conflict) {
    return {
      valid: false,
      message: `${item.title} overlaps with ${conflict.title} (${conflict.startTime}-${conflict.endTime}).`,
    };
  }

  return { valid: true, message: '' };
}

export function findScheduleConflict(item, existingItems) {
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);

  return existingItems.find((existing) => {
    const existingStart = timeToMinutes(existing.startTime);
    const existingEnd = timeToMinutes(existing.endTime);
    return start < existingEnd && end > existingStart;
  }) ?? null;
}

export async function getTravelCautions(item, existingItems, walkingRouteProvider) {
  const cautions = [];
  const start = timeToMinutes(item.startTime);
  const end = timeToMinutes(item.endTime);

  for (const existing of existingItems) {
    const existingStart = timeToMinutes(existing.startTime);
    const existingEnd = timeToMinutes(existing.endTime);

    if (existingEnd <= start) {
      const gapMinutes = start - existingEnd;
      const route = await walkingRouteProvider(existing.locationId, item.locationId);
      const walkMinutes = secondsToCeilMinutes(route.durationSeconds);
      if (walkMinutes > gapMinutes) {
        cautions.push(createTravelCaution(existing, item, gapMinutes, walkMinutes));
      }
    } else if (end <= existingStart) {
      const gapMinutes = existingStart - end;
      const route = await walkingRouteProvider(item.locationId, existing.locationId);
      const walkMinutes = secondsToCeilMinutes(route.durationSeconds);
      if (walkMinutes > gapMinutes) {
        cautions.push(createTravelCaution(item, existing, gapMinutes, walkMinutes));
      }
    }
  }

  return cautions;
}

function createTravelCaution(from, to, gapMinutes, walkMinutes) {
  return {
    message: `Caution: You only have ${formatMinutes(gapMinutes)} between ${from.title} and ${to.title}, but the walk is estimated to take ${formatMinutes(walkMinutes)}.`,
    fromId: from.id,
    toId: to.id,
    gapMinutes,
    walkMinutes,
  };
}

function formatMinutes(minutes) {
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

function secondsToCeilMinutes(seconds) {
  return Math.max(1, Math.ceil(seconds / 60));
}

export function timeToMinutes(time) {
  if (!time || !time.includes(':')) {
    return Number.NaN;
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }

  return hours * 60 + minutes;
}
