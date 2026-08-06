using { finfly as db } from '../db/schema';
using { sap.common as common } from '@sap/cds/common';

@path '/expenses'
service ExpenseService {

    @odata.draft.enabled
    entity FlightReports as projection on db.FlightReports;

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
}