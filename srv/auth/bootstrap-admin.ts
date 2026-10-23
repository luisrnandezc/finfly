import { randomUUID } from 'node:crypto';
import cds, { type Service } from '@sap/cds';
import { hashPassword, validatePassword } from './passwords.ts';

const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;

const entities = {
  Organizations: 'finfly.Organizations',
  CrewMembers: 'finfly.CrewMembers',
  OrganizationMembers: 'finfly.OrganizationMembers',
  UserCredentials: 'finfly.UserCredentials',
  UserSessions: 'finfly.UserSessions',
} as const;

export type BootstrapAdminInput = {
  organizationCode: string;
  organizationName: string;
  userId: string;
  password: string;
  nationalId: string;
  firstName: string;
  lastName: string;
};

export type BootstrapAdminResult = {
  organizationID: string;
  crewMemberID: string;
  createdOrganization: boolean;
  createdAdministrator: boolean;
};

export type BootstrapStaffInput = BootstrapAdminInput;

export type BootstrapStaffResult = {
  organizationID: string;
  crewMemberID: string;
  createdOrganization: boolean;
  createdStaffUser: boolean;
};

type AccountType = 'administrator' | 'staff';

type BootstrapAccountResult = {
  organizationID: string;
  crewMemberID: string;
  createdOrganization: boolean;
  createdAccount: boolean;
};

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

async function bootstrapOrganizationAccount(
  db: Service,
  input: BootstrapAdminInput,
  accountType: AccountType,
): Promise<BootstrapAccountResult> {
  const organizationCode = required(input.organizationCode, 'Organization code').toUpperCase();
  const organizationName = required(input.organizationName, 'Organization name');
  const accountLabel = accountType === 'staff' ? 'Staff' : 'Administrator';
  const userId = required(input.userId, `${accountLabel} User ID`);
  const nationalId = required(input.nationalId, `${accountLabel} National ID`);
  const firstName = required(input.firstName, `${accountLabel} first name`);
  const lastName = required(input.lastName, `${accountLabel} last name`);
  validatePassword(input.password);
  const passwordHash = await hashPassword(input.password);
  return (await db.tx(async (tx) => {
    let organization = (await tx.run(
      SELECT.one.from(entities.Organizations).columns('ID').where({ code: organizationCode }),
    )) as { ID: string } | undefined;
    const createdOrganization = !organization;
    if (!organization) {
      organization = { ID: randomUUID() };
      await tx.run(
        INSERT.into(entities.Organizations).entries({
          ID: organization.ID,
          code: organizationCode,
          name: organizationName,
          active: true,
        }),
      );
    } else {
      await tx.run(
        UPDATE.entity(entities.Organizations)
          .set({ name: organizationName, active: true })
          .where({ ID: organization.ID }),
      );
    }

    let account = (await tx.run(
      SELECT.one.from(entities.CrewMembers).columns('ID', 'organization_ID').where({ userId }),
    )) as { ID: string; organization_ID: string } | undefined;
    if (account && account.organization_ID !== organization.ID) {
      throw new Error(`${accountLabel} User ID ${userId} is already in use`);
    }
    const createdAccount = !account;
    if (!account) {
      account = { ID: randomUUID(), organization_ID: organization.ID };
      await tx.run(
        INSERT.into(entities.CrewMembers).entries({
          ID: account.ID,
          organization_ID: organization.ID,
          nationalId,
          firstName,
          lastName,
          userId,
          isPilot: false,
          isAuditor: false,
          isAdmin: accountType === 'administrator',
          isStaff: accountType === 'staff',
          active: true,
        }),
      );
    } else {
      await tx.run(
        UPDATE.entity(entities.CrewMembers)
          .set({
            nationalId,
            firstName,
            lastName,
            isAdmin: accountType === 'administrator',
            isStaff: accountType === 'staff',
            active: true,
          })
          .where({ ID: account.ID }),
      );
    }

    const membership = await tx.run(
      SELECT.one.from(entities.OrganizationMembers).columns('ID').where({
        organization_ID: organization.ID,
        userId,
      }),
    );
    if (membership) {
      await tx.run(
        UPDATE.entity(entities.OrganizationMembers)
          .set({ active: true })
          .where({ organization_ID: organization.ID, userId }),
      );
    } else {
      await tx.run(
        INSERT.into(entities.OrganizationMembers).entries({
          organization_ID: organization.ID,
          userId,
          active: true,
        }),
      );
    }

    const credential = (await tx.run(
      SELECT.one
        .from(entities.UserCredentials)
        .columns('ID')
        .where({ crewMember_ID: account.ID }),
    )) as { ID: string } | undefined;
    if (credential) {
      await tx.run(
        UPDATE.entity(entities.UserCredentials)
          .set({
            passwordHash,
            mustChangePassword: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
          })
          .where({ ID: credential.ID }),
      );
    } else {
      await tx.run(
        INSERT.into(entities.UserCredentials).entries({
          ID: randomUUID(),
          crewMember_ID: account.ID,
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
        }),
      );
    }
    await tx.run(
      DELETE.from(entities.UserSessions).where({ crewMember_ID: account.ID }),
    );

    return {
      organizationID: organization.ID,
      crewMemberID: account.ID,
      createdOrganization,
      createdAccount,
    };
  })) as BootstrapAccountResult;
}

/** Creates or refreshes the first administrator for an organization. */
export async function bootstrapOrganizationAdministrator(
  db: Service,
  input: BootstrapAdminInput,
): Promise<BootstrapAdminResult> {
  const result = await bootstrapOrganizationAccount(db, input, 'administrator');
  const { createdAccount, ...account } = result;
  return {
    ...account,
    createdAdministrator: createdAccount,
  };
}

/** Creates or refreshes a FinFly staff account in the internal organization. */
export async function bootstrapStaffUser(
  db: Service,
  input: BootstrapStaffInput,
): Promise<BootstrapStaffResult> {
  const result = await bootstrapOrganizationAccount(db, input, 'staff');
  const { createdAccount, ...account } = result;
  return {
    ...account,
    createdStaffUser: createdAccount,
  };
}
