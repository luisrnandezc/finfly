import cds from '@sap/cds';
import { bootstrapOrganizationAdministrator } from '../srv/auth/bootstrap-admin.ts';

type DisconnectableDatabase = { disconnect: () => Promise<void> };

function environmentValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const model = await cds.load('*');
cds.model = cds.linked(model);
const db = await cds.connect.to('db');

try {
  const result = await bootstrapOrganizationAdministrator(db, {
    organizationCode: environmentValue('FINFLY_ORG_CODE'),
    organizationName: environmentValue('FINFLY_ORG_NAME'),
    userId: environmentValue('FINFLY_ADMIN_USER_ID'),
    password: environmentValue('FINFLY_ADMIN_PASSWORD'),
    nationalId: environmentValue('FINFLY_ADMIN_NATIONAL_ID'),
    firstName: environmentValue('FINFLY_ADMIN_FIRST_NAME'),
    lastName: environmentValue('FINFLY_ADMIN_LAST_NAME'),
  });

  console.log(
    `${result.createdOrganization ? 'Created' : 'Updated'} organization ${process.env.FINFLY_ORG_CODE}.`,
  );
  console.log(
    `${result.createdAdministrator ? 'Created' : 'Updated'} administrator ${process.env.FINFLY_ADMIN_USER_ID}.`,
  );
  console.log('The administrator must change the temporary password at first login.');
} finally {
  await (db as unknown as DisconnectableDatabase).disconnect();
}
