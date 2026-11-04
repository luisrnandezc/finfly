export type FlightTimeMethod = 'TAKEOFF_LANDING' | 'HOBBS';

export interface FlightTimeInput {
  takeoffTime?: string | null;
  landingTime?: string | null;
  hourMeterStart?: number | string | null;
  hourMeterEnd?: number | string | null;
}

const roundedHours = (hours: number): number => Math.round(hours * 10) / 10;

const secondsSinceMidnight = (value: string): number => {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error('Times must use a valid 24-hour format');

  const [, hoursText, minutesText, secondsText = '0'] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);

  if (hours > 23 || minutes > 59 || seconds > 59) {
    throw new Error('Times must use a valid 24-hour format');
  }

  return hours * 3600 + minutes * 60 + seconds;
};

/** Calculates a leg's airborne time using the method configured for its aircraft. */
export function calculateFlightHours(
  method: FlightTimeMethod,
  input: FlightTimeInput,
): number | null {
  if (method === 'HOBBS') {
    if (input.hourMeterStart == null || input.hourMeterEnd == null) return null;

    const start = Number(input.hourMeterStart);
    const end = Number(input.hourMeterEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error('Hobbs End must be greater than Hobbs Start');
    }

    return roundedHours(end - start);
  }

  if (!input.takeoffTime || !input.landingTime) return null;

  const takeoff = secondsSinceMidnight(input.takeoffTime);
  let landing = secondsSinceMidnight(input.landingTime);
  if (landing <= takeoff) landing += 24 * 60 * 60;

  return roundedHours((landing - takeoff) / 3600);
}
