using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path: '/expenses'
service ExpenseService {

    @odata.draft.enabled
    entity FlightReports as projection on db.FlightReports actions {

        action submit() returns FlightReports;

        action approve(
            comment : String(1000)
        ) returns FlightReports;

        action rejectReport(
            reason : String(1000) not null
        ) returns FlightReports;

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