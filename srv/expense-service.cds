using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path: '/expenses'
service ExpenseService {

    @odata.draft.enabled
    entity FlightReports as projection on db.FlightReports actions {

        @requires: 'Pilot'
        action submit() returns FlightReports;

        @requires: 'Auditor'
        action approveAllExpenses() returns FlightReports;

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
        action resubmitExpense() returns Expenses;
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
    {
        grant: 'READ',
        to: [
            'Pilot',
            'Auditor',
            'Admin'
        ]
    },
    {
        grant: [
            'CREATE',
            'UPDATE',
            'DELETE'
        ],
        to: [
            'Pilot',
            'Admin'
        ]
    },
    {
        grant: [
            'submit',
            'refreshExchangeRates'
        ],
        to: [
            'Pilot',
            'Admin'
        ]
    },
    {
        grant: [
            'approveAllExpenses',
        ],
        to: [
            'Auditor',
            'Admin'
        ]
    }
];

annotate ExpenseService.FlightLegs with @restrict: [
    {
        grant: 'READ',
        to: [
            'Pilot',
            'Auditor',
            'Admin'
        ]
    },
    {
        grant: 'WRITE',
        to: [
            'Pilot',
            'Admin'
        ]
    }
];

annotate ExpenseService.CrewAssignments with @restrict: [
    {
        grant: 'READ',
        to: [
            'Pilot',
            'Auditor',
            'Admin'
        ]
    },
    {
        grant: 'WRITE',
        to: [
            'Pilot',
            'Admin'
        ]
    }
];

annotate ExpenseService.Expenses with @restrict: [
    {
        grant: 'READ',
        to: [
            'Pilot',
            'Auditor',
            'Admin'
        ]
    },
    {
        grant: 'WRITE',
        to: [
            'Pilot',
            'Admin'
        ]
    },
    {
        grant: [
            'approveExpense',
            'requestExpenseCorrection'
        ],
        to: [
            'Auditor',
            'Admin'
        ]
    },
    {
        grant: 'resubmitExpense',
        to: [
            'Pilot',
            'Admin'
        ]
    }
];

annotate ExpenseService.FlightReportHistory with @restrict: [
    {
        grant: 'READ',
        to: [
            'Pilot',
            'Auditor',
            'Admin'
        ]
    }
];

annotate ExpenseService.ExpenseAuditHistory with @restrict: [
    {
        grant: 'READ',
        to: [
            'Pilot',
            'Auditor',
            'Admin'
        ]
    }
];
