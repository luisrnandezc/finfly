export type FlightLegSummaryInput = {
  flightDate?: string | null;
  flightHours?: number | string | null;
};

export type FlightReportSummary = {
  firstFlightDate: string | null;
  lastFlightDate: string | null;
  totalFlightHours: number;
};

/**
 * Derives the operational trip summary from its flight legs.
 * CDS Date values use YYYY-MM-DD, so lexical ordering is chronological.
 */
export function calculateFlightReportSummary(
  legs: FlightLegSummaryInput[],
): FlightReportSummary {
  const dates = legs
    .map((leg) => leg.flightDate)
    .filter((date): date is string => Boolean(date))
    .sort();

  const unroundedHours = legs.reduce((total, leg) => {
    if (leg.flightHours === null || leg.flightHours === undefined) return total;
    return total + Number(leg.flightHours);
  }, 0);

  return {
    firstFlightDate: dates.at(0) ?? null,
    lastFlightDate: dates.at(-1) ?? null,
    totalFlightHours: Math.round((unroundedHours + Number.EPSILON) * 100) / 100,
  };
}
