import { DateTime } from "luxon";

// Weekly cadence anchor in UCLA local time: Monday at 9:00 AM. Luxon
// weekdays are 1=Monday through 7=Sunday.
export const SCHEDULE_WEEKDAY = 1;
export const SCHEDULE_HOUR = 9;
export const SCHEDULE_MINUTE = 0;

/**
 * Return the earliest Monday-9:00-AM occurrence strictly at or after `after`,
 * snapped to the second.
 */
export function nextScheduledOccurrence(after: DateTime): DateTime {
  let candidate = after.set({
    hour: SCHEDULE_HOUR,
    minute: SCHEDULE_MINUTE,
    second: 0,
    millisecond: 0,
  });
  while (candidate < after || candidate.weekday !== SCHEDULE_WEEKDAY) {
    candidate = candidate.plus({ days: 1 });
  }
  return candidate;
}

/**
 * Whether the provided instant lands exactly on the weekly schedule anchor
 * (correct weekday, hour, and minute).
 */
export function matchesSchedule(instant: DateTime): boolean {
  return (
    instant.isValid &&
    instant.weekday === SCHEDULE_WEEKDAY &&
    instant.hour === SCHEDULE_HOUR &&
    instant.minute === SCHEDULE_MINUTE
  );
}
