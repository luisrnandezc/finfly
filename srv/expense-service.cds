using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path: '/expenses'
service ExpenseService {

    @odata.draft.enabled
    entity FlightReports as projection on db.FlightReports actions {

        @requires: 'Pilot'
        action submit() returns FlightReports;

        @requires: 'Auditor'
        action approve(
            comment : String(1000)
        ) returns FlightReports;

        @requires: 'Auditor'
        action rejectReport(
            reason : String(1000) not null
        ) returns FlightReports;

        @requires: 'Pilot'
        action refreshExchangeRates() returns FlightReports;
    };

    @readonly
    entity FlightReportHistory as projection on db.FlightReportHistory;

    entity FlightLegs as projection on db.FlightLegs;
    entity CrewAssignments as projection on db.CrewAssignments;
    entity Expenses as projection on db.Expenses;

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
    status          @readonly;
    submittedAt     @readonly;
    submittedBy     @readonly;
    reviewedAt      @readonly;
    reviewedBy      @readonly;
    rejectionReason @readonly;
    statusHistory   @readonly;
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
            'approve',
            'rejectReport'
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
