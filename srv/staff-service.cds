using { finfly as db } from '../db/schema';

@path: '/staff'
@requires: 'Staff'
service StaffService {
    @readonly
    entity Organizations as projection on db.Organizations {
        key ID,
        code,
        name,
        active,
        createdAt,
        modifiedAt,
        virtual activeUserCount  : Integer,
        virtual activePilotCount : Integer,
        virtual activeAuditorCount : Integer,
        virtual activeAdministratorCount : Integer
    } actions {
        action addAdministrator(
            @title: 'User ID'
            userId            : String(255) not null,
            @title: 'Temporary Password'
            temporaryPassword : String(200) not null,
            @title: 'National ID'
            nationalId        : String(40) not null,
            @title: 'First Name'
            firstName         : String(80) not null,
            @title: 'Last Name'
            lastName          : String(80) not null
        ) returns Administrators;
        action deactivateOrganization() returns Organizations;
        action reactivateOrganization() returns Organizations;
    };

    @readonly
    entity Administrators as projection on db.CrewMembers {
        key ID,
        organization,
        organization.name as organizationName : String(120),
        fullName,
        userId,
        active,
        createdAt,
        modifiedAt
    } where isAdmin = true and isStaff = false
    actions {
        action deactivateAdministrator() returns Administrators;
        action reactivateAdministrator() returns Administrators;
        action setTemporaryPassword(
            @title: 'Temporary Password'
            password : String(200) not null
        ) returns Administrators;
    };

    action createOrganization(
        code               : String(20) not null,
        name               : String(120) not null,
        administratorUserId : String(255) not null,
        temporaryPassword  : String(200) not null,
        nationalId         : String(40) not null,
        firstName          : String(80) not null,
        lastName           : String(80) not null
    ) returns Organizations;
}
