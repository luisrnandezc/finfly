import { describe, expect, it } from 'vitest';
import { calculateFlightHours } from '../../srv/domain/flight-time.ts';

describe('calculateFlightHours', () => {
  it('calculates airborne time and supports a flight crossing midnight', () => {
    expect(
      calculateFlightHours('TAKEOFF_LANDING', {
        takeoffTime: '22:45:00',
        landingTime: '00:15:00',
      }),
    ).toBe(1.5);
  });

  it('calculates the Hobbs difference to one decimal place', () => {
    expect(
      calculateFlightHours('HOBBS', {
        hourMeterStart: 1250.2,
        hourMeterEnd: 1252.56,
      }),
    ).toBe(2.4);
  });

  it('returns no result until both values are available', () => {
    expect(
      calculateFlightHours('TAKEOFF_LANDING', { takeoffTime: '10:00:00' }),
    ).toBeNull();
  });
});
