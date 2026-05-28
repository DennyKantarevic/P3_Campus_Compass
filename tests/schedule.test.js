import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getTravelCautions,
  findScheduleConflict,
  validateScheduleItem,
} from '../src/schedule.js';

describe('schedule validation', () => {
  it('rejects an event whose end time is not after the start time', () => {
    const result = validateScheduleItem({
      title: 'Office hours',
      locationId: 14,
      startTime: '10:40',
      endTime: '10:40',
    }, []);

    assert.deepEqual(result, {
      valid: false,
      message: 'End time must be after start time.',
    });
  });

  it('blocks overlapping classes and events', () => {
    const existing = [
      {
        id: 'class-COP3530',
        title: 'COP3530',
        locationId: 14,
        startTime: '10:40',
        endTime: '11:30',
      },
    ];

    assert.deepEqual(findScheduleConflict({
      id: 'event-study',
      title: 'Study group',
      locationId: 12,
      startTime: '11:00',
      endTime: '12:00',
    }, existing), existing[0]);
  });

  it('allows adjacent classes when one ends exactly as the next begins', () => {
    const result = validateScheduleItem({
      title: 'COP3504',
      locationId: 14,
      startTime: '11:45',
      endTime: '12:35',
    }, [
      {
        id: 'class-COP3530',
        title: 'COP3530',
        locationId: 14,
        startTime: '10:40',
        endTime: '11:45',
      },
    ]);

    assert.deepEqual(result, { valid: true, message: '' });
  });

  it('allows tight back-to-back classes but returns a travel caution', async () => {
    const cautions = await getTravelCautions({
      id: 'class-COP3530',
      title: 'COP3530',
      locationId: 14,
      startTime: '10:10',
      endTime: '11:00',
    }, [
      {
        id: 'class-COP3502',
        title: 'COP3502',
        locationId: 23,
        startTime: '09:00',
        endTime: '10:00',
      },
    ], async () => ({ durationSeconds: 15 * 60 }));

    assert.deepEqual(cautions, [{
      message: 'Caution: You only have 10 minutes between COP3502 and COP3530, but the walk is estimated to take 15 minutes.',
      fromId: 'class-COP3502',
      toId: 'class-COP3530',
      gapMinutes: 10,
      walkMinutes: 15,
    }]);
  });

  it('formats singular gap values in travel cautions', async () => {
    const cautions = await getTravelCautions({
      id: 'class-COP3530',
      title: 'COP3530',
      locationId: 14,
      startTime: '10:01',
      endTime: '11:00',
    }, [
      {
        id: 'class-COP3502',
        title: 'COP3502',
        locationId: 23,
        startTime: '09:00',
        endTime: '10:00',
      },
    ], async () => ({ durationSeconds: 2 * 60 }));

    assert.equal(
      cautions[0].message,
      'Caution: You only have 1 minute between COP3502 and COP3530, but the walk is estimated to take 2 minutes.',
    );
  });
});
