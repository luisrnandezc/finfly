import cds from '@sap/cds';
import type { NextFunction, Request, Response } from 'express';
import { cookieValue, SESSION_COOKIE, sessionTokenHash } from './session.ts';

const { SELECT } = cds.ql;

export type SessionUser = {
  ID?: string;
  userId: string;
  organization_ID: string;
  isPilot: boolean;
  isAuditor: boolean;
  isAdmin: boolean;
  mustChangePassword?: boolean;
  organizationName: string;
};

export async function resolveSessionUser(req: Request): Promise<SessionUser | undefined> {
  const token = cookieValue(req.headers.cookie, SESSION_COOKIE);
  if (!token) return undefined;

  const db = await cds.connect.to('db');
  const entities = cds.entities('finfly');
  const session = (await db.run(
    SELECT.one.from(entities.UserSessions).columns('crewMember_ID').where({
      tokenHash: sessionTokenHash(token),
      expiresAt: { '>': new Date().toISOString() },
    }),
  )) as { crewMember_ID: string } | undefined;
  if (!session) return undefined;

  const user = (await db.run(
    SELECT.one
      .from(entities.CrewMembers)
      .columns('userId', 'organization_ID', 'isPilot', 'isAuditor', 'isAdmin')
      .where({ ID: session.crewMember_ID, active: true }),
  )) as SessionUser | undefined;
  if (!user?.userId) return undefined;

  const credential = (await db.run(
    SELECT.one
      .from(entities.UserCredentials)
      .columns('mustChangePassword')
      .where({ crewMember_ID: session.crewMember_ID }),
  )) as { mustChangePassword: boolean } | undefined;
  if (!credential) return undefined;

  const membership = await db.run(
    SELECT.one.from(entities.OrganizationMembers).columns('ID').where({
      organization_ID: user.organization_ID,
      userId: user.userId,
      active: true,
    }),
  );
  if (!membership) return undefined;

  const organization = (await db.run(
    SELECT.one.from(entities.Organizations).columns('name').where({
      ID: user.organization_ID,
      active: true,
    }),
  )) as { name: string } | undefined;
  return organization ? { ...user, ...credential, organizationName: organization.name } : undefined;
}

/** CAP custom-authentication middleware backed by FinFly sessions. */
export default async function databaseAuthentication(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionUser = await resolveSessionUser(req);
    if (sessionUser) {
      const roles = sessionUser.mustChangePassword
        ? []
        : [
        sessionUser.isPilot && 'Pilot',
        sessionUser.isAuditor && 'Auditor',
        sessionUser.isAdmin && 'Admin',
          ].filter((role): role is string => Boolean(role));
      cds.context!.user = new cds.User({
        id: sessionUser.userId,
        roles,
        attr: { organization: sessionUser.organization_ID },
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}
