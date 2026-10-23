import cds from '@sap/cds';
import { bootstrapStaffUser } from '../srv/auth/bootstrap-admin.ts';

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
  const result = await bootstrapStaffUser(db, {
    organizationCode: 'FINFLY',
    organizationName: 'FinFly',
    userId: environmentValue('FINFLY_STAFF_USER_ID'),
    password: environmentValue('FINFLY_STAFF_PASSWORD'),
    nationalId: environmentValue('FINFLY_STAFF_NATIONAL_ID'),
    firstName: environmentValue('FINFLY_STAFF_FIRST_NAME'),
    lastName: environmentValue('FINFLY_STAFF_LAST_NAME'),
  });

  console.log(
    `${result.createdOrganization ? 'Created' : 'Updated'} internal FinFly organization.`,
  );
  console.log(
    `${result.createdStaffUser ? 'Created' : 'Updated'} staff user ${process.env.FINFLY_STAFF_USER_ID}.`,
  );
  console.log('The staff user must change the temporary password at first login.');
} finally {
  await (db as unknown as DisconnectableDatabase).disconnect();
}
