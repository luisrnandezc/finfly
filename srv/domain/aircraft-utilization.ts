export type NumericValue = number | string;

export type AircraftUtilizationInput = {
  aircraftFlightHours: NumericValue;
  aircraftCycles: number;
  reportFlightHours: NumericValue;
  reportCycles: number;
  postedFlightHours: NumericValue;
  postedCycles: number;
  utilizationPosted: boolean;
};

export type AircraftUtilizationUpdate = {
  flightHoursDelta: number;
  cyclesDelta: number;
  currentFlightHours: number;
  totalCycles: number;
  postedFlightHours: number;
  postedCycles: number;
};

const decimal = (value: NumericValue, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return Number(parsed.toFixed(2));
};

const cycles = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
};

/**
 * Calculates the idempotent change needed to synchronize one report's
 * contribution with the cumulative utilization stored on its aircraft.
 */
export function calculateAircraftUtilizationUpdate(
  input: AircraftUtilizationInput,
): AircraftUtilizationUpdate {
  const aircraftFlightHours = decimal(
    input.aircraftFlightHours,
    'Aircraft flight hours',
  );
  const aircraftCycles = cycles(input.aircraftCycles, 'Aircraft cycles');
  const reportFlightHours = decimal(
    input.reportFlightHours,
    'Report flight hours',
  );
  const reportCycles = cycles(input.reportCycles, 'Report cycles');

  // An unposted report contributes zero, regardless of its default snapshot.
  const previousFlightHours = input.utilizationPosted
    ? decimal(input.postedFlightHours, 'Posted flight hours')
    : 0;
  const previousCycles = input.utilizationPosted
    ? cycles(input.postedCycles, 'Posted cycles')
    : 0;

  const flightHoursDelta = Number(
    (reportFlightHours - previousFlightHours).toFixed(2),
  );
  const cyclesDelta = reportCycles - previousCycles;
  const currentFlightHours = Number(
    (aircraftFlightHours + flightHoursDelta).toFixed(2),
  );
  const totalCycles = aircraftCycles + cyclesDelta;

  if (currentFlightHours < 0 || totalCycles < 0) {
    throw new Error('Aircraft utilization cannot become negative');
  }

  return {
    flightHoursDelta,
    cyclesDelta,
    currentFlightHours,
    totalCycles,
    postedFlightHours: reportFlightHours,
    postedCycles: reportCycles,
  };
}
