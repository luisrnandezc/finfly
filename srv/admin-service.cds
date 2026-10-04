using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path: '/admin'
@requires: 'Admin'
service AdminService {
    @cds.redirection.target
    entity Users as projection on db.CrewMembers actions {
        action deactivateUser() returns Users;
        action reactivateUser() returns Users;
    };

    entity Aircraft as projection on db.Aircraft actions {
        action deactivateAircraft() returns Aircraft;
        action reactivateAircraft() returns Aircraft;
    };

    @readonly
    @cds.redirection.target: false
    entity Pilots as projection on db.CrewMembers
        where isPilot = true and active = true;

    @readonly
    entity FlightReports as projection on db.FlightReports {
        *,
        auditStatus as reviewStatus : String(30)
    } actions {
        action approveAllExpenses() returns FlightReports;
    };

    @readonly
    entity Expenses as projection on db.Expenses {
        *,
        case
            when auditStatus = 'NEEDS_CORRECTION' then 'ACTION_REQUIRED'
            else auditStatus
        end as reviewStatus : String(30)
    } actions {
        action approveExpense() returns Expenses;
        action requestExpenseCorrection(
            reason : String(1000) not null
        ) returns Expenses;
    };

    @readonly entity FlightLegs as projection on db.FlightLegs;
    @readonly entity CrewAssignments as projection on db.CrewAssignments;
    @readonly entity ExpenseAuditHistory as projection on db.ExpenseAuditHistory;
    @readonly entity Organizations as projection on db.Organizations;
    @readonly entity ExpenseCategories as projection on db.ExpenseCategories;
    @readonly entity ReportAuditStatuses as projection on db.ReportAuditStatuses;
    @readonly entity PilotLicenseTypes as projection on db.PilotLicenseTypes;
    @readonly entity AircraftTypes as projection on db.AircraftTypes;
    @readonly entity Currencies as projection on common.Currencies;
}

annotate AdminService.Users with {
    organization @readonly;
    active       @readonly;
    fullName     @readonly;
};

annotate AdminService.Aircraft with {
    organization @readonly;
    active       @readonly;
};

annotate AdminService.Users with @restrict: [
    { grant : 'CREATE' },
    {
        grant : [ 'READ', 'UPDATE', 'DELETE', 'deactivateUser', 'reactivateUser' ],
        where : 'organization_ID = $user.organization'
    }
];

annotate AdminService.Aircraft with @restrict: [
    { grant : 'CREATE' },
    {
        grant : [ 'READ', 'UPDATE', 'DELETE', 'deactivateAircraft', 'reactivateAircraft' ],
        where : 'organization_ID = $user.organization'
    }
];

annotate AdminService.Pilots with @restrict: [{
    grant : 'READ',
    where : 'organization_ID = $user.organization'
}];

annotate AdminService.FlightReports with @restrict: [
    { grant : 'READ', where : 'organization_ID = $user.organization' },
    {
        grant : 'approveAllExpenses',
        where : 'organization_ID = $user.organization and status = ''SUBMITTED'''
    }
];

annotate AdminService.Expenses with @restrict: [
    {
        grant : 'READ',
        where : 'report.organization_ID = $user.organization'
    },
    {
        grant : [ 'approveExpense', 'requestExpenseCorrection' ],
        where : 'report.organization_ID = $user.organization and report.status = ''SUBMITTED'''
    }
];

annotate AdminService.FlightLegs with @restrict: [{
    grant : 'READ',
    where : 'report.organization_ID = $user.organization'
}];

annotate AdminService.CrewAssignments with @restrict: [{
    grant : 'READ',
    where : 'report.organization_ID = $user.organization'
}];

annotate AdminService.ExpenseAuditHistory with @restrict: [{
    grant : 'READ',
    where : 'expense.report.organization_ID = $user.organization'
}];

annotate AdminService.Organizations with @restrict: [{
    grant : 'READ',
    where : 'ID = $user.organization'
}];
