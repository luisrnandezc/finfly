using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path: '/expenses'
service ExpenseService {

    @readonly
    entity Organizations as projection on db.Organizations;

    @odata.draft.enabled
    entity FlightReports as projection on db.FlightReports {
        *,
        case
            when auditStatus = 'ACTION_REQUIRED' then true
            when status = 'DRAFT' then true
            else false
        end as requiresPilotAttention : Boolean,
        case
            when auditStatus = 'ACTION_REQUIRED' then 1
            when status = 'DRAFT' then 2
            else 3
        end as pilotAttentionPriority : Integer
    } actions {

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
            fuelQuantity        : Decimal(12,2),
            fuelUnit            : db.FuelUnit
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
            expenseDate @(
                title : 'Expense Date',
                UI.ParameterDefaultValue : in.expenseDate
            ) : Date,
            categoryCode @(
                title : 'Category',
                UI.ParameterDefaultValue : in.category.code,
                Common.ValueListWithFixedValues : true,
                Common.ValueList : {
                    CollectionPath : 'ExpenseCategories',
                    Parameters : [
                        {
                            $Type : 'Common.ValueListParameterInOut',
                            LocalDataProperty : categoryCode,
                            ValueListProperty : 'code'
                        },
                        {
                            $Type : 'Common.ValueListParameterDisplayOnly',
                            ValueListProperty : 'name'
                        }
                    ]
                }
            ) : String(30),
            originalAmount @(
                title : 'Amount',
                UI.ParameterDefaultValue : in.originalAmount
            ) : Decimal(15,2),
            originalCurrencyCode @(
                title : 'Currency',
                UI.ParameterDefaultValue : in.originalCurrency_code,
                Common.ValueListWithFixedValues : true,
                Common.ValueList : {
                    CollectionPath : 'Currencies',
                    Parameters : [{
                        $Type : 'Common.ValueListParameterInOut',
                        LocalDataProperty : originalCurrencyCode,
                        ValueListProperty : 'code'
                    }]
                }
            ) : String(3),
            legID @(
                title : 'Flight Leg',
                UI.ParameterDefaultValue : in.leg_ID,
                Common.ValueList : {
                    CollectionPath : 'FlightLegs',
                    Parameters : [
                        {
                            $Type : 'Common.ValueListParameterIn',
                            LocalDataProperty : in.report_ID,
                            ValueListProperty : 'report_ID'
                        },
                        {
                            $Type : 'Common.ValueListParameterInOut',
                            LocalDataProperty : legID,
                            ValueListProperty : 'ID'
                        },
                        {
                            $Type : 'Common.ValueListParameterDisplayOnly',
                            ValueListProperty : 'sequence'
                        },
                        {
                            $Type : 'Common.ValueListParameterDisplayOnly',
                            ValueListProperty : 'flightDate'
                        },
                        {
                            $Type : 'Common.ValueListParameterDisplayOnly',
                            ValueListProperty : 'originAirportCode'
                        },
                        {
                            $Type : 'Common.ValueListParameterDisplayOnly',
                            ValueListProperty : 'destinationAirportCode'
                        }
                    ]
                }
            ) : UUID,
            description @(
                title : 'Description',
                UI.ParameterDefaultValue : in.description
            ) : String(255),
            supplier @(
                title : 'Supplier',
                UI.ParameterDefaultValue : in.supplier
            ) : String(160),
            receiptNumber @(
                title : 'Receipt Number',
                UI.ParameterDefaultValue : in.receiptNumber
            ) : String(80),
            fuelQuantity @(
                title : 'Fuel Quantity',
                UI.ParameterDefaultValue : in.fuelQuantity
            ) : Decimal(12,2),
            fuelUnit @(
                title : 'Fuel Unit',
                UI.ParameterDefaultValue : in.fuelUnit,
                Common.ValueListWithFixedValues : true,
                Common.ValueList : {
                    CollectionPath : 'FuelUnits',
                    Parameters : [{
                        $Type : 'Common.ValueListParameterInOut',
                        LocalDataProperty : fuelUnit,
                        ValueListProperty : 'code'
                    }]
                }
            ) : db.FuelUnit
        ) returns Expenses;
    };

    @readonly
    entity Aircraft as projection on db.Aircraft;

    @readonly
    entity CrewMembers as projection on db.CrewMembers;

    @readonly
    entity CrewRoles as projection on db.CrewRoles;

    @readonly
    entity FuelUnits as projection on db.FuelUnits;

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
    displayTitle  @readonly;
    auditStatus   @readonly;
    pendingExpenseCount @readonly;
    firstFlightDate  @readonly;
    lastFlightDate   @readonly;
    totalFlightHours @readonly;
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
    fuelQuantityLiters            @readonly;
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
