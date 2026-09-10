import { describe, expect, it } from 'vitest';

import { calculateAircraftUtilizationUpdate } from '../../srv/domain/aircraft-utilization.ts';

describe('aircraft utilization calculation', () => {
  it('posts a report contribution for the first time', () => {
    const result = calculateAircraftUtilizationUpdate({
      aircraftFlightHours: 2450.5,
      aircraftCycles: 1820,
      reportFlightHours: 5.35,
      reportCycles: 3,
      postedFlightHours: 0,
      postedCycles: 0,
      utilizationPosted: false,
    });

    expect(result).to.deep.equal({
      flightHoursDelta: 5.35,
      cyclesDelta: 3,
      currentFlightHours: 2455.85,
      totalCycles: 1823,
      postedFlightHours: 5.35,
      postedCycles: 3,
    });
  });

  it('applies only the difference when a posted contribution changes', () => {
    const result = calculateAircraftUtilizationUpdate({
      aircraftFlightHours: '2455.85',
      aircraftCycles: 1823,
      reportFlightHours: '6.10',
      reportCycles: 4,
      postedFlightHours: '5.35',
      postedCycles: 3,
      utilizationPosted: true,
    });

    expect(result.flightHoursDelta).to.equal(0.75);
    expect(result.cyclesDelta).to.equal(1);
    expect(result.currentFlightHours).to.equal(2456.6);
    expect(result.totalCycles).to.equal(1824);
  });

  it('produces no delta when the contribution is already synchronized', () => {
    const result = calculateAircraftUtilizationUpdate({
      aircraftFlightHours: 2455.85,
      aircraftCycles: 1823,
      reportFlightHours: 5.35,
      reportCycles: 3,
      postedFlightHours: 5.35,
      postedCycles: 3,
      utilizationPosted: true,
    });

    expect(result.flightHoursDelta).to.equal(0);
    expect(result.cyclesDelta).to.equal(0);
    expect(result.currentFlightHours).to.equal(2455.85);
    expect(result.totalCycles).to.equal(1823);
  });

  it('supports reversing a previously posted contribution', () => {
    const result = calculateAircraftUtilizationUpdate({
      aircraftFlightHours: 2455.85,
      aircraftCycles: 1823,
      reportFlightHours: 0,
      reportCycles: 0,
      postedFlightHours: 5.35,
      postedCycles: 3,
      utilizationPosted: true,
    });

    expect(result.flightHoursDelta).to.equal(-5.35);
    expect(result.cyclesDelta).to.equal(-3);
    expect(result.currentFlightHours).to.equal(2450.5);
    expect(result.totalCycles).to.equal(1820);
  });

  it('rejects invalid source values and negative resulting totals', () => {
    expect(() =>
      calculateAircraftUtilizationUpdate({
        aircraftFlightHours: 10,
        aircraftCycles: 2,
        reportFlightHours: -1,
        reportCycles: 1,
        postedFlightHours: 0,
        postedCycles: 0,
        utilizationPosted: false,
      }),
    ).to.throw('Report flight hours must be a non-negative number');

    expect(() =>
      calculateAircraftUtilizationUpdate({
        aircraftFlightHours: 1,
        aircraftCycles: 1,
        reportFlightHours: 0,
        reportCycles: 0,
        postedFlightHours: 2,
        postedCycles: 2,
        utilizationPosted: true,
      }),
    ).to.throw('Aircraft utilization cannot become negative');
  });
});
