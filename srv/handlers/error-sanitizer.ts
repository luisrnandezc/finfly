import cds from '@sap/cds';

const INTERNAL_ERROR_MESSAGE =
  'The request could not be completed. Please try again.';

type ServiceError = Error & {
  code?: string | number;
  status?: number;
  statusCode?: number;
  [key: string]: unknown;
};

type ErrorLogger = Pick<ReturnType<typeof cds.log>, 'error'>;

const logger = cds.log('finfly');

function httpStatus(error: ServiceError): number | undefined {
  const candidates = [error.status, error.statusCode, error.code];

  for (const candidate of candidates) {
    const status = Number(candidate);
    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      return status;
    }
  }

  return undefined;
}

export function sanitizeServiceError(
  error: Error,
  errorLogger: ErrorLogger = logger,
): void {
  const serviceError = error as ServiceError;
  const status = httpStatus(serviceError);

  if (status !== undefined && status < 500) return;

  errorLogger.error('Unexpected service error', error);

  for (const key of Object.keys(serviceError)) {
    delete serviceError[key];
  }

  serviceError.message = INTERNAL_ERROR_MESSAGE;
  serviceError.code = '500';
  serviceError.status = 500;
}

export function registerErrorSanitizer(service: cds.Service): void {
  service.on('error', (error) => sanitizeServiceError(error));
}
