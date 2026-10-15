import cds, { type Request, type Transaction } from '@sap/cds';
import { hashPassword, validatePassword } from '../auth/passwords.ts';

const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;

type AdminUserData = {
  ID: string;
  organization_ID: string;
  nationalId?: string;
  userId?: string | null;
  firstName?: string;
  lastName?: string;
  isPilot?: boolean;
  isAuditor?: boolean;
  isAdmin?: boolean;
  licenseType?: string | null;
  active?: boolean;
};

type AircraftData = {
  ID: string;
  organization_ID: string;
  registration: string;
  defaultPIC_ID?: string | null;
  defaultSIC_ID?: string | null;
};

function organizationFor(req: Request): string {
  const organizationID = req.user.attr?.organization as string | undefined;
  if (!organizationID) {
    req.reject(403, 'No organization is assigned to the authenticated user');
  }
  return organizationID!;
}

function entityID(req: Request): string | undefined {
  const key = req.params[0] as { ID?: string } | undefined;
  return key?.ID ?? (req.data.ID as string | undefined);
}

function normalizeAircraftRegistration(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().toUpperCase();
}

async function validateAircraftRegistration(
  tx: Transaction,
  registration: string | undefined,
  aircraftID: string | undefined,
  req: Request,
): Promise<void> {
  if (registration === undefined) return;
  if (!registration) req.reject(400, 'Aircraft registration is required');

  const duplicate = (await tx.run(
    SELECT.one.from('finfly.Aircraft').columns('ID').where({ registration }),
  )) as { ID: string } | undefined;
  if (duplicate && duplicate.ID !== aircraftID) {
    req.reject(409, 'An aircraft with this registration already exists');
  }
}

async function validateUserId(
  tx: Transaction,
  userId: string | null | undefined,
  userID: string | undefined,
  req: Request,
): Promise<void> {
  const normalized = userId?.trim();
  if (!normalized) return;
  const duplicate = (await tx.run(
    SELECT.one.from('finfly.CrewMembers').columns('ID').where({ userId: normalized }),
  )) as { ID: string } | undefined;
  if (duplicate && duplicate.ID !== userID) {
    req.reject(409, 'A user with this User ID already exists');
  }
}

function validateUser(user: AdminUserData, req: Request): void {
  if (!user.nationalId?.trim()) req.reject(400, 'National ID is required');
  if (!user.userId?.trim()) req.reject(400, 'User ID is required');
  if (!user.firstName?.trim()) req.reject(400, 'First name is required');
  if (!user.lastName?.trim()) req.reject(400, 'Last name is required');
  if (!user.isPilot && !user.isAuditor && !user.isAdmin) {
    req.reject(400, 'Select at least one application role');
  }
  if (user.isPilot && !user.licenseType) {
    req.reject(400, 'License type is required for pilots');
  }
}

async function validateDefaultPilots(
  tx: Transaction,
  organizationID: string,
  defaultPICID: string | null | undefined,
  defaultSICID: string | null | undefined,
  req: Request,
): Promise<void> {
  if (defaultPICID && defaultPICID === defaultSICID) {
    req.reject(400, 'Default PIC and SIC must be different pilots');
  }

  for (const [role, pilotID] of [
    ['PIC', defaultPICID],
    ['SIC', defaultSICID],
  ] as const) {
    if (!pilotID) continue;

    const pilot = await tx.run(
      SELECT.one.from('finfly.CrewMembers').columns('ID').where({
        ID: pilotID,
        organization_ID: organizationID,
        isPilot: true,
        active: true,
      }),
    );
    if (!pilot) {
      req.reject(
        400,
        `Default ${role} must be an active pilot from this organization`,
      );
    }
  }
}

/** Registers organization-scoped user and aircraft administration behavior. */
export function registerAdminHandlers(service: cds.ApplicationService): void {
  const { Users, Aircraft } = service.entities as any;
  const db = cds.entities('finfly');

  service.before('CREATE', Users, async (req: Request) => {
    const organizationID = organizationFor(req);
    req.data.organization_ID = organizationID;
    req.data.active = true;
    validateUser(req.data as AdminUserData, req);
    await validateUserId(cds.tx(req), req.data.userId, undefined, req);
  });

  service.after('CREATE', Users, async (data: AdminUserData, req: Request) => {
    const tx = cds.tx(req);
    await tx.run(
      INSERT.into(db.OrganizationMembers).entries({
        organization_ID: data.organization_ID,
        userId: data.userId,
        active: true,
      }),
    );
  });

  service.before('UPDATE', Users, async (req: Request) => {
    const ID = entityID(req);
    const organizationID = organizationFor(req);
    const existing = (await SELECT.one.from(db.CrewMembers).where({
      ID,
      organization_ID: organizationID,
    })) as AdminUserData | undefined;
    if (!existing) req.reject(404, 'This user is no longer available');

    const merged = { ...existing, ...req.data } as AdminUserData;
    merged.organization_ID = organizationID;
    validateUser(merged, req);
    await validateUserId(cds.tx(req), merged.userId, ID, req);
    (req as Request & { previousUserId?: string | null }).previousUserId =
      existing!.userId;
    req.data.organization_ID = organizationID;
  });

  service.after('UPDATE', Users, async (data: AdminUserData, req: Request) => {
    const tx = cds.tx(req);
    const ID = entityID(req) ?? data.ID;
    const previousUserId = (
      req as Request & { previousUserId?: string | null }
    ).previousUserId;
    const updated = (await tx.run(
      SELECT.one.from(db.CrewMembers).columns('userId', 'active').where({ ID }),
    )) as AdminUserData;

    await tx.run(
      UPDATE.entity(db.OrganizationMembers)
        .set({ userId: updated.userId, active: updated.active })
        .where({
          organization_ID: organizationFor(req),
          userId: previousUserId ?? updated.userId,
        }),
    );
  });

  service.before('DELETE', Users, (req: Request) => {
    req.reject(405, 'Deactivate the user instead of deleting it');
  });

  service.on('deactivateUser', Users, async (req: Request) => {
    const ID = entityID(req);
    const organizationID = organizationFor(req);
    const tx = cds.tx(req);
    const user = (await tx.run(
      SELECT.one.from(db.CrewMembers).columns('ID', 'userId').where({
        ID,
        organization_ID: organizationID,
      }),
    )) as AdminUserData | undefined;
    if (!user) return req.reject(404, 'This user is no longer available');

    await tx.run(
      UPDATE.entity(db.CrewMembers).set({ active: false }).where({ ID }),
    );
    await tx.run(
      UPDATE.entity(db.OrganizationMembers).set({ active: false }).where({
        organization_ID: organizationID,
        userId: user.userId,
      }),
    );
    await tx.run(DELETE.from(db.UserSessions).where({ crewMember_ID: ID }));
    await tx.run(
      UPDATE.entity(db.Aircraft)
        .set({ defaultPIC_ID: null })
        .where({ organization_ID: organizationID, defaultPIC_ID: ID }),
    );
    await tx.run(
      UPDATE.entity(db.Aircraft)
        .set({ defaultSIC_ID: null })
        .where({ organization_ID: organizationID, defaultSIC_ID: ID }),
    );
    req.notify('User deactivated successfully');
    return tx.run(SELECT.one.from(db.CrewMembers).where({ ID }));
  });

  service.on('reactivateUser', Users, async (req: Request) => {
    const ID = entityID(req);
    const organizationID = organizationFor(req);
    const tx = cds.tx(req);
    const user = (await tx.run(
      SELECT.one.from(db.CrewMembers).columns('ID', 'userId').where({
        ID,
        organization_ID: organizationID,
      }),
    )) as AdminUserData | undefined;
    if (!user) return req.reject(404, 'This user is no longer available');

    await tx.run(
      UPDATE.entity(db.CrewMembers).set({ active: true }).where({ ID }),
    );
    await tx.run(
      UPDATE.entity(db.OrganizationMembers).set({ active: true }).where({
        organization_ID: organizationID,
        userId: user.userId,
      }),
    );
    req.notify('User reactivated successfully');
    return tx.run(SELECT.one.from(db.CrewMembers).where({ ID }));
  });

  service.on('setTemporaryPassword', Users, async (req: Request) => {
    const ID = entityID(req);
    const organizationID = organizationFor(req);
    const password = req.data.password;
    try {
      validatePassword(password);
    } catch (error) {
      return req.reject(400, (error as Error).message);
    }

    const tx = cds.tx(req);
    const user = await tx.run(
      SELECT.one.from(db.CrewMembers).columns('ID').where({
        ID,
        organization_ID: organizationID,
        active: true,
      }),
    );
    if (!user) return req.reject(404, 'This active user is no longer available');

    const passwordHash = await hashPassword(password);
    const credential = (await tx.run(
      SELECT.one.from(db.UserCredentials).columns('ID').where({ crewMember_ID: ID }),
    )) as { ID: string } | undefined;
    if (credential) {
      await tx.run(
        UPDATE.entity(db.UserCredentials)
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
        INSERT.into(db.UserCredentials).entries({
          crewMember_ID: ID,
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
        }),
      );
    }
    await tx.run(DELETE.from(db.UserSessions).where({ crewMember_ID: ID }));
    req.notify('Temporary password set successfully');
    return tx.run(SELECT.one.from(db.CrewMembers).where({ ID }));
  });

  service.before('CREATE', Aircraft, async (req: Request) => {
    const organizationID = organizationFor(req);
    const registration = normalizeAircraftRegistration(req.data.registration);
    if (registration !== undefined) req.data.registration = registration;
    req.data.organization_ID = organizationID;
    req.data.active = true;
    const tx = cds.tx(req);
    await validateAircraftRegistration(
      tx,
      registration,
      req.data.ID as string | undefined,
      req,
    );
    await validateDefaultPilots(
      tx,
      organizationID,
      req.data.defaultPIC_ID as string | null | undefined,
      req.data.defaultSIC_ID as string | null | undefined,
      req,
    );
  });

  service.before('UPDATE', Aircraft, async (req: Request) => {
    const ID = entityID(req);
    const organizationID = organizationFor(req);
    const existing = (await SELECT.one
      .from(db.Aircraft)
      .columns('ID', 'registration', 'defaultPIC_ID', 'defaultSIC_ID')
      .where({
        ID,
        organization_ID: organizationID,
      })) as AircraftData | undefined;
    if (!existing) req.reject(404, 'This aircraft is no longer available');

    req.data.organization_ID = organizationID;
    const merged = { ...existing, ...req.data } as AircraftData;
    const registration = normalizeAircraftRegistration(merged.registration);
    if (registration !== undefined) {
      req.data.registration = registration;
      merged.registration = registration;
    }
    const tx = cds.tx(req);
    await validateAircraftRegistration(tx, registration, ID, req);
    await validateDefaultPilots(
      tx,
      organizationID,
      merged.defaultPIC_ID,
      merged.defaultSIC_ID,
      req,
    );
  });

  service.before('DELETE', Aircraft, (req: Request) => {
    req.reject(405, 'Deactivate the aircraft instead of deleting it');
  });

  const setAircraftActive = async (
    req: Request,
    active: boolean,
  ): Promise<unknown> => {
    const ID = entityID(req);
    const organizationID = organizationFor(req);
    const tx = cds.tx(req);
    const aircraft = await tx.run(
      SELECT.one.from(db.Aircraft).columns('ID').where({
        ID,
        organization_ID: organizationID,
      }),
    );
    if (!aircraft) {
      return req.reject(404, 'This aircraft is no longer available');
    }

    await tx.run(UPDATE.entity(db.Aircraft).set({ active }).where({ ID }));
    req.notify(`Aircraft ${active ? 'reactivated' : 'deactivated'} successfully`);
    return tx.run(SELECT.one.from(db.Aircraft).where({ ID }));
  };

  service.on('deactivateAircraft', Aircraft, (req: Request) =>
    setAircraftActive(req, false),
  );
  service.on('reactivateAircraft', Aircraft, (req: Request) =>
    setAircraftActive(req, true),
  );
}
