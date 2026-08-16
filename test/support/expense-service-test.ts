import cds from '@sap/cds';

type TestWithDefaults = ReturnType<typeof cds.test> & {
  defaults: {
    auth?: {
      username: string;
      password: string;
    };
  };
};

export function expenseServiceTest(options: { withMocks?: boolean } = {}) {
  const test = (
    options.withMocks
      ? cds.test('serve', 'all', '--with-mocks', '--in-memory')
      : cds.test('serve', 'all', '--in-memory')
  ) as TestWithDefaults;

  // Most existing tests exercise pilot-owned CRUD behavior.
  // Individual authorization tests can override this per request.
  test.defaults.auth = {
    username: 'pilot',
    password: 'pilot',
  };

  return test;
}
