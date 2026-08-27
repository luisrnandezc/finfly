using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path: '/expenses'
service ExpenseService {

    @readonly
    entity Organizations as projection on db.Organizations;

    @odata.draft.enabled
    entity FlightReports as projection on db.FlightReports actions {

        @requires: 'Pilot'
        action submit() returns FlightReports;

        @requires: 'Auditor'
        action approveAllExpenses() returns FlightReports;

        @requires: 'Pilot'
        action addExpense(
            expenseDate         : Date not null,
            categoryID          : UUID not null,
            originalAmount      : Decimal(15,2) not null,
            originalCurrencyCode: String(3) not null,
            legID               : UUID,
            description         : String(255),
            supplier            : String(160),
            receiptNumber       : String(80),
            fuelQuantityLiters  : Decimal(12,2)
        ) returns Expenses;

        @requires: 'Pilot'
        action refreshExchangeRates() returns FlightReports;
    };

    @readonly
    entity FlightReportHistory as projection on db.FlightReportHistory;

    @readonly
    entity ExpenseAuditHistory as projection on db.ExpenseAuditHistory;

    entity FlightLegs as projection on db.FlightLegs;
    entity CrewAssignments as projection on db.CrewAssignments;

    entity Expenses as projection on db.Expenses actions {

        @requires: 'Auditor'
        action approveExpense() returns Expenses;

        @requires: 'Auditor'
        action requestExpenseCorrection(
            reason : String(1000) not null
        ) returns Expenses;

        @requires: 'Pilot'
        action resubmitExpense(
            expenseDate          : Date,
            categoryID           : UUID,
            originalAmount       : Decimal(15,2),
            originalCurrencyCode : String(3),
            legID                : UUID,
            description          : String(255),
            supplier             : String(160),
            receiptNumber        : String(80),
            fuelQuantityLiters   : Decimal(12,2)
        ) returns Expenses;
    };

    @readonly
    entity Aircraft as projection on db.Aircraft;

    @readonly
    entity CrewMembers as projection on db.CrewMembers;

    @readonly
    entity ExpenseCategories as projection on db.ExpenseCategories;

    @readonly
    entity Currencies as projection on common.Currencies;

    event FlightReportSubmitted {
        reportID     : UUID;
        reportNumber : String(30);
        submittedBy  : String(255);
        submittedAt  : Timestamp;
    }
}

annotate ExpenseService.FlightReports with {
    status        @readonly;
    auditStatus   @readonly;
    submittedAt   @readonly;
    submittedBy   @readonly;
    statusHistory @readonly;
};

annotate ExpenseService.Expenses with {
    auditStatus                   @readonly;
    submittedForAuditAt           @readonly;
    auditedAt                     @readonly;
    auditedBy                     @readonly;
    correctionReason              @readonly;
    addedAfterReportSubmission    @readonly;
    auditHistory                  @readonly;
};

annotate ExpenseService.FlightReports with @restrict: [
    { grant: 'READ', to: [ 'Pilot', 'Auditor', 'Admin' ], where: 'organization_ID = $user.organization' },
    { grant: 'CREATE', to: [ 'Pilot', 'Admin' ] },
    { grant: [ 'UPDATE', 'DELETE' ], to: [ 'Pilot', 'Admin' ], where: 'organization_ID = $user.organization' },
    { grant: [ 'submit', 'addExpense', 'refreshExchangeRates' ], to: [ 'Pilot', 'Admin' ], where: 'organization_ID = $user.organization' },
    { grant: 'approveAllExpenses', to: [ 'Auditor', 'Admin' ], where: 'organization_ID = $user.organization' }
];

annotate ExpenseService.FlightLegs with @restrict: [
    { grant: 'READ', to: [ 'Pilot', 'Auditor', 'Admin' ], where: 'report.organization_ID = $user.organization' },
    { grant: 'WRITE', to: [ 'Pilot', 'Admin' ], where: 'report.organization_ID = $user.organization' }
];

annotate ExpenseService.CrewAssignments with @restrict: [
    { grant: 'READ', to: [ 'Pilot', 'Auditor', 'Admin' ], where: 'report.organization_ID = $user.organization' },
    { grant: 'WRITE', to: [ 'Pilot', 'Admin' ], where: 'report.organization_ID = $user.organization' }
];

annotate ExpenseService.Expenses with @restrict: [
    { grant: 'READ', to: [ 'Pilot', 'Auditor', 'Admin' ], where: 'report.organization_ID = $user.organization' },
    { grant: 'WRITE', to: [ 'Pilot', 'Admin' ], where: 'report.organization_ID = $user.organization' },
    { grant: [ 'approveExpense', 'requestExpenseCorrection' ], to: [ 'Auditor', 'Admin' ], where: 'report.organization_ID = $user.organization' },
    { grant: 'resubmitExpense', to: [ 'Pilot', 'Admin' ], where: 'report.organization_ID = $user.organization' }
];

annotate ExpenseService.FlightReportHistory with @restrict: [{
    grant: 'READ',
    to: [ 'Pilot', 'Auditor', 'Admin' ],
    where: 'report.organization_ID = $user.organization'
}];

annotate ExpenseService.ExpenseAuditHistory with @restrict: [{
    grant: 'READ',
    to: [ 'Pilot', 'Auditor', 'Admin' ],
    where: 'expense.report.organization_ID = $user.organization'
}];

annotate ExpenseService.Organizations with @restrict: [{
    grant: 'READ',
    to: [ 'Pilot', 'Auditor', 'Admin' ],
    where: 'ID = $user.organization'
}];

annotate ExpenseService.Aircraft with @restrict: [{
    grant: 'READ',
    to: [ 'Pilot', 'Auditor', 'Admin' ],
    where: 'organization_ID = $user.organization'
}];

annotate ExpenseService.CrewMembers with @restrict: [{
    grant: 'READ',
    to: [ 'Pilot', 'Auditor', 'Admin' ],
    where: 'organization_ID = $user.organization'
}];
