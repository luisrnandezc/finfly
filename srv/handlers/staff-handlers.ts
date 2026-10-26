import { randomUUID } from 'node:crypto';
import cds, { type Request, type Transaction } from '@sap/cds';
import { hashPassword, validatePassword } from '../auth/passwords.ts';

const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;
const INTERNAL_ORGANIZATION_CODE = 'FINFLY';

type OrganizationRow = {
  ID: string;
  code: string;
  active: boolean;
  activeUserCount?: number;
  activePilotCount?: number;
  activeAuditorCount?: number;
  activeAdministratorCount?: number;
};

type AdministratorRow = {
  ID: string;
  organization_ID: string;
  userId: string | null;
  active: boolean;
};

type StaffUserRow = AdministratorRow & {
  nationalId: string;
  firstName: string;
  lastName: string;
  positionTitle?: string | null;
  licenseType?: string | null;
  totalFlightHours: number;
};

type StaffUpdateRequest = Request & {
  previousUserId?: string | null;
};

function required(value: unknown, label: string, req: Request): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) req.reject(400, `${label} is required`);
  return normalized;
}

function entityID(req: Request): string | undefined {
  const key = req.params[0] as { ID?: string } | undefined;
  return key?.ID ?? (req.data.ID as string | undefined);
}

async function uniqueUserId(tx: Transaction, userId: string, req: Request): Promise<void> {
  const existing = await tx.run(
    SELECT.one.from('finfly.CrewMembers').columns('ID').where({ userId }),
  );
  if (existing) req.reject(409, 'A user with this User ID already exists');
}

async function createAdministrator(
  tx: Transaction,
  organizationID: string,
  data: Record<string, unknown>,
  req: Request,
): Promise<AdministratorRow> {
  const userId = required(
    data.userId ?? data.administratorUserId,
    'Administrator User ID',
    req,
  );
  const nationalId = required(data.nationalId, 'National ID', req);
  const firstName = required(data.firstName, 'First name', req);
  const lastName = required(data.lastName, 'Last name', req);
  const password = required(data.temporaryPassword, 'Temporary password', req);
  try {
    validatePassword(password);
  } catch (error) {
    return req.reject(400, (error as Error).message);
  }
  await uniqueUserId(tx, userId, req);

  const duplicateNationalID = await tx.run(
    SELECT.one.from('finfly.CrewMembers').columns('ID').where({
      nationalId,
    }),
  );
  if (duplicateNationalID) {
    return req.reject(409, 'A user with this National ID already exists');
  }

  const crewMemberID = randomUUID();
  await tx.run(
    INSERT.into('finfly.CrewMembers').entries({
      ID: crewMemberID,
      organization_ID: organizationID,
      nationalId,
      firstName,
      lastName,
      userId,
      isPilot: false,
      isAuditor: false,
      isAdmin: true,
      isStaff: false,
      totalFlightHours: 0,
      active: true,
    }),
  );
  await tx.run(
    INSERT.into('finfly.OrganizationMembers').entries({
      ID: randomUUID(),
      organization_ID: organizationID,
      userId,
      active: true,
    }),
  );
  await tx.run(
    INSERT.into('finfly.UserCredentials').entries({
      ID: randomUUID(),
      crewMember_ID: crewMemberID,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      failedLoginAttempts: 0,
    }),
  );
  return tx.run(SELECT.one.from('finfly.CrewMembers').where({ ID: crewMemberID }));
}

/** Registers internal customer-organization and administrator management. */
export function registerStaffHandlers(service: cds.ApplicationService): void {
  const { Organizations, Users, Administrators } = service.entities as any;

  service.before('UPDATE', Organizations, async (req: Request) => {
    const ID = entityID(req);
    const tx = cds.tx(req);
    const organization = await tx.run(
      SELECT.one.from('finfly.Organizations').columns('ID').where({ ID }),
    );
    if (!organization) req.reject(404, 'This organization is no longer available');
    req.data.name = required(req.data.name, 'Organization name', req);
  });

  service.before('UPDATE', Users, async (req: StaffUpdateRequest) => {
    const ID = entityID(req);
    const tx = cds.tx(req);
    const existing = (await tx.run(
      SELECT.one.from('finfly.CrewMembers').where({ ID, isStaff: false }),
    )) as StaffUserRow | undefined;
    if (!existing) req.reject(404, 'This user is no longer available');

    const merged = { ...existing, ...req.data } as StaffUserRow;
    merged.nationalId = required(merged.nationalId, 'National ID', req);
    merged.firstName = required(merged.firstName, 'First name', req);
    merged.lastName = required(merged.lastName, 'Last name', req);

    if (Object.hasOwn(req.data, 'userId')) {
      merged.userId = required(merged.userId, 'User ID', req);
    }
    if (merged.userId) {
      merged.userId = merged.userId.trim();
      const duplicateUser = (await tx.run(
        SELECT.one.from('finfly.CrewMembers').columns('ID').where({
          userId: merged.userId,
        }),
      )) as { ID: string } | undefined;
      if (duplicateUser && duplicateUser.ID !== ID) {
        req.reject(409, 'A user with this User ID already exists');
      }
    }

    const duplicateNationalID = (await tx.run(
      SELECT.one.from('finfly.CrewMembers').columns('ID').where({
        nationalId: merged.nationalId,
      }),
    )) as { ID: string } | undefined;
    if (duplicateNationalID && duplicateNationalID.ID !== ID) {
      req.reject(409, 'A user with this National ID already exists');
    }

    const totalFlightHours = Number(merged.totalFlightHours);
    if (!Number.isFinite(totalFlightHours) || totalFlightHours < 0) {
      req.reject(400, 'Total flight hours must be zero or greater');
    }

    req.previousUserId = existing!.userId;
    req.data.nationalId = merged.nationalId;
    req.data.firstName = merged.firstName;
    req.data.lastName = merged.lastName;
    if (Object.hasOwn(req.data, 'userId')) req.data.userId = merged.userId;
  });

  service.after('UPDATE', Users, async (_data: StaffUserRow, req: StaffUpdateRequest) => {
    const ID = entityID(req);
    const tx = cds.tx(req);
    const updated = (await tx.run(
      SELECT.one
        .from('finfly.CrewMembers')
        .columns('organization_ID', 'userId', 'active')
        .where({ ID }),
    )) as StaffUserRow;

    if (req.previousUserId === updated.userId || !updated.userId) return;

    const membership = req.previousUserId
      ? await tx.run(
        SELECT.one.from('finfly.OrganizationMembers').columns('ID').where({
          organization_ID: updated.organization_ID,
          userId: req.previousUserId,
        }),
      )
      : undefined;
    if (membership) {
      await tx.run(
        UPDATE.entity('finfly.OrganizationMembers')
          .set({ userId: updated.userId, active: updated.active })
          .where({ ID: membership.ID }),
      );
    } else {
      const currentMembership = await tx.run(
        SELECT.one.from('finfly.OrganizationMembers').columns('ID').where({
          organization_ID: updated.organization_ID,
          userId: updated.userId,
        }),
      );
      if (!currentMembership) {
        await tx.run(
          INSERT.into('finfly.OrganizationMembers').entries({
            ID: randomUUID(),
            organization_ID: updated.organization_ID,
            userId: updated.userId,
            active: updated.active,
          }),
        );
      }
    }
    await tx.run(DELETE.from('finfly.UserSessions').where({ crewMember_ID: ID }));
  });

  service.after('READ', Organizations, async (result: OrganizationRow | OrganizationRow[], req) => {
    const organizations = Array.isArray(result) ? result : result ? [result] : [];
    if (organizations.length === 0) return;

    const organizationIDs = organizations.map(({ ID }) => ID);
    const users = (await cds.tx(req).run(
      SELECT.from('finfly.CrewMembers')
        .columns('organization_ID', 'isPilot', 'isAuditor', 'isAdmin')
        .where({ organization_ID: { in: organizationIDs }, active: true }),
    )) as Array<{
      organization_ID: string;
      isPilot: boolean;
      isAuditor: boolean;
      isAdmin: boolean;
    }>;

    for (const organization of organizations) {
      const organizationUsers = users.filter(
        (user) => user.organization_ID === organization.ID,
      );
      organization.activeUserCount = organizationUsers.length;
      organization.activePilotCount = organizationUsers.filter((user) => user.isPilot).length;
      organization.activeAuditorCount = organizationUsers.filter((user) => user.isAuditor).length;
      organization.activeAdministratorCount = organizationUsers.filter(
        (user) => user.isAdmin,
      ).length;
    }
  });

  service.on('createOrganization', async (req: Request) => {
    const code = required(req.data.code, 'Organization code', req).toUpperCase();
    const name = required(req.data.name, 'Organization name', req);
    const tx = cds.tx(req);
    const duplicate = await tx.run(
      SELECT.one.from('finfly.Organizations').columns('ID').where({ code }),
    );
    if (duplicate) return req.reject(409, 'An organization with this code already exists');

    const organizationID = randomUUID();
    await tx.run(
      INSERT.into('finfly.Organizations').entries({
        ID: organizationID,
        code,
        name,
        active: true,
      }),
    );
    await createAdministrator(tx, organizationID, req.data, req);
    req.notify('Organization and administrator created successfully');
    return tx.run(SELECT.one.from('finfly.Organizations').where({ ID: organizationID }));
  });

  service.on('addAdministrator', Organizations, async (req: Request) => {
    const organizationID = entityID(req);
    const tx = cds.tx(req);
    const organization = (await tx.run(
      SELECT.one.from('finfly.Organizations').columns('ID', 'code').where({
        ID: organizationID,
        active: true,
      }),
    )) as OrganizationRow | undefined;
    if (!organization) return req.reject(404, 'This active organization is no longer available');
    if (organization.code === INTERNAL_ORGANIZATION_CODE) {
      return req.reject(400, 'Customer administrators cannot be added to the internal organization');
    }

    const administrator = await createAdministrator(tx, organization.ID, req.data, req);
    req.notify('Administrator created successfully');
    return administrator;
  });

  const setOrganizationActive = async (req: Request, active: boolean): Promise<unknown> => {
    const ID = entityID(req);
    const tx = cds.tx(req);
    const organization = (await tx.run(
      SELECT.one.from('finfly.Organizations').columns('ID', 'code').where({ ID }),
    )) as OrganizationRow | undefined;
    if (!organization) return req.reject(404, 'This organization is no longer available');
    if (organization.code === INTERNAL_ORGANIZATION_CODE) {
      return req.reject(400, 'The internal FinFly organization cannot be deactivated');
    }

    await tx.run(UPDATE.entity('finfly.Organizations').set({ active }).where({ ID }));
    if (!active) {
      const users = await tx.run(
        SELECT.from('finfly.CrewMembers').columns('ID').where({ organization_ID: ID }),
      );
      const userIDs = users.map((user: { ID: string }) => user.ID);
      if (userIDs.length > 0) {
        await tx.run(
          DELETE.from('finfly.UserSessions').where({ crewMember_ID: { in: userIDs } }),
        );
      }
    }
    req.notify(`Organization ${active ? 'reactivated' : 'deactivated'} successfully`);
    return tx.run(SELECT.one.from('finfly.Organizations').where({ ID }));
  };

  service.on('deactivateOrganization', Organizations, (req: Request) =>
    setOrganizationActive(req, false),
  );
  service.on('reactivateOrganization', Organizations, (req: Request) =>
    setOrganizationActive(req, true),
  );

  const administratorForAction = async (
    req: Request,
    active?: boolean,
  ): Promise<AdministratorRow | undefined> => {
    const ID = entityID(req);
    const where: Record<string, unknown> = { ID, isAdmin: true, isStaff: false };
    if (active !== undefined) where.active = active;
    return cds.tx(req).run(
      SELECT.one
        .from('finfly.CrewMembers')
        .columns('ID', 'organization_ID', 'userId', 'active')
        .where(where),
    );
  };

  const setAdministratorActive = async (req: Request, active: boolean): Promise<unknown> => {
    const administrator = await administratorForAction(req);
    if (!administrator) return req.reject(404, 'This administrator is no longer available');
    const tx = cds.tx(req);
    await tx.run(
      UPDATE.entity('finfly.CrewMembers').set({ active }).where({ ID: administrator.ID }),
    );
    await tx.run(
      UPDATE.entity('finfly.OrganizationMembers').set({ active }).where({
        organization_ID: administrator.organization_ID,
        userId: administrator.userId,
      }),
    );
    if (!active) {
      await tx.run(
        DELETE.from('finfly.UserSessions').where({ crewMember_ID: administrator.ID }),
      );
    }
    req.notify(`Administrator ${active ? 'reactivated' : 'deactivated'} successfully`);
    return tx.run(SELECT.one.from('finfly.CrewMembers').where({ ID: administrator.ID }));
  };

  service.on('deactivateAdministrator', Administrators, (req: Request) =>
    setAdministratorActive(req, false),
  );
  service.on('reactivateAdministrator', Administrators, (req: Request) =>
    setAdministratorActive(req, true),
  );

  service.on('setTemporaryPassword', Administrators, async (req: Request) => {
    const administrator = await administratorForAction(req, true);
    if (!administrator) return req.reject(404, 'This active administrator is no longer available');
    const password = required(req.data.password, 'Temporary password', req);
    try {
      validatePassword(password);
    } catch (error) {
      return req.reject(400, (error as Error).message);
    }

    const tx = cds.tx(req);
    const passwordHash = await hashPassword(password);
    const credential = await tx.run(
      SELECT.one.from('finfly.UserCredentials').columns('ID').where({
        crewMember_ID: administrator.ID,
      }),
    );
    if (credential) {
      await tx.run(
        UPDATE.entity('finfly.UserCredentials')
          .set({ passwordHash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null })
          .where({ ID: credential.ID }),
      );
    } else {
      await tx.run(
        INSERT.into('finfly.UserCredentials').entries({
          ID: randomUUID(),
          crewMember_ID: administrator.ID,
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
        }),
      );
    }
    await tx.run(DELETE.from('finfly.UserSessions').where({ crewMember_ID: administrator.ID }));
    req.notify('Temporary password set successfully');
    return tx.run(SELECT.one.from('finfly.CrewMembers').where({ ID: administrator.ID }));
  });
}
