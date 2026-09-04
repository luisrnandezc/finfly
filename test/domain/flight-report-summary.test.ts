import { describe, expect, it } from 'vitest';
import { calculateFlightReportSummary } from '../../srv/domain/flight-report-summary.ts';

describe('calculateFlightReportSummary', () => {
  it('derives chronological dates and total hours from unordered legs', () => {
    const summary = calculateFlightReportSummary([
      { flightDate: '2026-08-15', flightHours: '2.20' },
      { flightDate: '2026-08-12', flightHours: 1.15 },
      { flightDate: '2026-08-13', flightHours: '0.45' },
    ]);

    expect(summary).toEqual({
      firstFlightDate: '2026-08-12',
      lastFlightDate: '2026-08-15',
      totalFlightHours: 3.8,
    });
  });

  it('treats missing flight hours as zero', () => {
    const summary = calculateFlightReportSummary([
      { flightDate: '2026-08-12', flightHours: null },
      { flightDate: '2026-08-13' },
    ]);

    expect(summary).toEqual({
      firstFlightDate: '2026-08-12',
      lastFlightDate: '2026-08-13',
      totalFlightHours: 0,
    });
  });

  it('returns an empty summary when there are no flight legs', () => {
    expect(calculateFlightReportSummary([])).toEqual({
      firstFlightDate: null,
      lastFlightDate: null,
      totalFlightHours: 0,
    });
  });
});
