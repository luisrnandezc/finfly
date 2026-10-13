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

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

/** Creates or refreshes the first administrator for an organization. */
export async function bootstrapOrganizationAdministrator(
  db: Service,
  input: BootstrapAdminInput,
): Promise<BootstrapAdminResult> {
  const organizationCode = required(input.organizationCode, 'Organization code').toUpperCase();
  const organizationName = required(input.organizationName, 'Organization name');
  const userId = required(input.userId, 'Administrator User ID');
  const nationalId = required(input.nationalId, 'Administrator National ID');
  const firstName = required(input.firstName, 'Administrator first name');
  const lastName = required(input.lastName, 'Administrator last name');
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

    let administrator = (await tx.run(
      SELECT.one.from(entities.CrewMembers).columns('ID').where({
        organization_ID: organization.ID,
        userId,
      }),
    )) as { ID: string } | undefined;
    const createdAdministrator = !administrator;
    if (!administrator) {
      administrator = { ID: randomUUID() };
      await tx.run(
        INSERT.into(entities.CrewMembers).entries({
          ID: administrator.ID,
          organization_ID: organization.ID,
          nationalId,
          firstName,
          lastName,
          userId,
          isPilot: false,
          isAuditor: false,
          isAdmin: true,
          active: true,
        }),
      );
    } else {
      await tx.run(
        UPDATE.entity(entities.CrewMembers)
          .set({ nationalId, firstName, lastName, isAdmin: true, active: true })
          .where({ ID: administrator.ID }),
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
        .where({ crewMember_ID: administrator.ID }),
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
          crewMember_ID: administrator.ID,
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
        }),
      );
    }
    await tx.run(
      DELETE.from(entities.UserSessions).where({ crewMember_ID: administrator.ID }),
    );

    return {
      organizationID: organization.ID,
      crewMemberID: administrator.ID,
      createdOrganization,
      createdAdministrator,
    };
  })) as BootstrapAdminResult;
}
