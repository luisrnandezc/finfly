import { describe, expect, it, vi } from 'vitest';
import { sanitizeServiceError } from '../srv/handlers/error-sanitizer.ts';

function testLogger() {
  return { error: vi.fn() };
}

describe('service error sanitizer', () => {
  it('preserves expected business errors', () => {
    const error = Object.assign(new Error('Only draft reports can be edited'), {
      code: '409',
      status: 409,
      target: 'status',
    });
    const logger = testLogger();

    sanitizeServiceError(error, logger);

    expect(error).toMatchObject({
      message: 'Only draft reports can be edited',
      code: '409',
      status: 409,
      target: 'status',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('sanitizes server errors and removes technical details', () => {
    const error = Object.assign(
      new Error('no such column: aircraft2.registration'),
      {
        code: 'SQLITE_ERROR',
        statusCode: 500,
        query: 'SELECT * FROM ExpenseService_FlightReports',
        details: [{ message: 'database schema detail' }],
      },
    );
    const logger = testLogger();

    sanitizeServiceError(error, logger);

    expect(error).toMatchObject({
      message: 'The request could not be completed. Please try again.',
      code: '500',
      status: 500,
    });
    expect(error).not.toHaveProperty('statusCode');
    expect(error).not.toHaveProperty('query');
    expect(error).not.toHaveProperty('details');
    expect(logger.error).toHaveBeenCalledWith(
      'Unexpected service error',
      error,
    );
  });

  it('treats errors without an HTTP status as internal errors', () => {
    const error = new Error('Unexpected programming failure');
    const logger = testLogger();

    sanitizeServiceError(error, logger);

    expect(error).toMatchObject({
      message: 'The request could not be completed. Please try again.',
      code: '500',
      status: 500,
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
