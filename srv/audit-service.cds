using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path: '/audit'
@requires: [ 'Auditor', 'Admin' ]
service AuditService {

    @readonly
    entity FlightReports as projection on db.FlightReports actions {
        action approveAllExpenses() returns FlightReports;
    };

    @readonly
    entity Expenses as projection on db.Expenses actions {
        action approveExpense() returns Expenses;
        action requestExpenseCorrection(
            reason : String(1000) not null
        ) returns Expenses;
    };

    @readonly
    entity ExpenseAuditHistory as projection on db.ExpenseAuditHistory;

    @readonly
    entity Organizations as projection on db.Organizations;

    @readonly
    entity Aircraft as projection on db.Aircraft;

    @readonly
    entity FlightLegs as projection on db.FlightLegs;

    @readonly
    entity CrewAssignments as projection on db.CrewAssignments;

    @readonly
    entity CrewMembers as projection on db.CrewMembers;

    @readonly
    entity ExpenseCategories as projection on db.ExpenseCategories;

    @readonly
    entity ReportAuditStatuses as projection on db.ReportAuditStatuses
        where code <> 'NOT_STARTED';

    @readonly
    entity ExpenseAuditStatuses as projection on db.ExpenseAuditStatuses
        where code <> 'DRAFT';

    @readonly
    entity Currencies as projection on common.Currencies;
}

annotate AuditService.FlightReports with @restrict: [
    {
        grant : 'READ',
        where : 'organization_ID = $user.organization and status = ''SUBMITTED'''
    },
    {
        grant : 'approveAllExpenses',
        where : 'organization_ID = $user.organization and status = ''SUBMITTED'''
    }
];

annotate AuditService.Expenses with @restrict: [
    {
        grant : 'READ',
        where : 'report.organization_ID = $user.organization and report.status = ''SUBMITTED'''
    },
    {
        grant : [ 'approveExpense', 'requestExpenseCorrection' ],
        where : 'report.organization_ID = $user.organization and report.status = ''SUBMITTED'''
    }
];

annotate AuditService.ExpenseAuditHistory with @restrict: [{
    grant : 'READ',
    where : 'expense.report.organization_ID = $user.organization and expense.report.status = ''SUBMITTED'''
}];

annotate AuditService.Organizations with @restrict: [{
    grant : 'READ',
    where : 'ID = $user.organization'
}];

annotate AuditService.Aircraft with @restrict: [{
    grant : 'READ',
    where : 'organization_ID = $user.organization'
}];

annotate AuditService.FlightLegs with @restrict: [{
    grant : 'READ',
    where : 'report.organization_ID = $user.organization and report.status = ''SUBMITTED'''
}];

annotate AuditService.CrewAssignments with @restrict: [{
    grant : 'READ',
    where : 'report.organization_ID = $user.organization and report.status = ''SUBMITTED'''
}];

annotate AuditService.CrewMembers with @restrict: [{
    grant : 'READ',
    where : 'organization_ID = $user.organization'
}];
