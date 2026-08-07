namespace finfly;

using {
    cuid,
    managed,
    sap.common.Currencies
} from '@sap/cds/common';

using {
    Attachments
} from '@cap-js/attachments';

type FlightReportStatus : String enum {
    draft       = 'DRAFT';
    submitted   = 'SUBMITTED';
    underReview = 'UNDER_REVIEW';
    approved    = 'APPROVED';
    rejected    = 'REJECTED';
}

type CrewRole : String enum {
    captain      = 'CAPTAIN';
    firstOfficer = 'FIRST_OFFICER';
    crew         = 'CREW';
};

@assert.unique: {
    registration: [registration]
}
entity Aircraft : cuid, managed {
    registration : String(20) not null;
    description  : String(100);
}

entity CrewMembers : cuid, managed {
    firstName : String(80) not null;
    lastName  : String(80) not null;
    active    : Boolean default true;
}

@assert.unique: {
    code: [code]
}
entity ExpenseCategories : cuid, managed {
    code        : String(30) not null;
    name        : localized String(100) not null;
    description : localized String(255);
    active      : Boolean default true;
}

@assert.unique: {
    reportNumber: [reportNumber]
}
entity FlightReports : cuid, managed {
    reportNumber    : String(30) not null;

    @assert.target
    aircraft        : Association to Aircraft not null;

    requesterName   : String(160);
    status          : FlightReportStatus default #draft;
    notes           : LargeString;

    legs            : Composition of many FlightLegs 
                      on legs.report = $self;

    crew            : Composition of many CrewAssignments
                      on crew.report = $self;

    expenses        : Composition of many Expenses
                      on expenses.report = $self;
}

@assert.unique: {
    reportSequence: [report, sequence]
}
entity FlightLegs : cuid, managed {
    report                 : Association to FlightReports not null;

    @assert.range: [(0), _]
    sequence               : Integer not null;

    flightDate             : Date not null;
    originAirportCode      : String(4) not null;
    destinationAirportCode : String(4) not null;

    @assert.range: [(0), _]
    flightHours            : Decimal(5,2);

    @assert.range: [(0), _]
    hourMeterStart         : Decimal(10,2);

    @assert.range: [(0), _]
    hourMeterEnd           : Decimal(10,2);
}

entity CrewAssignments : cuid {
    report     : Association to FlightReports not null;

    @assert.target
    crewMember : Association to CrewMembers not null;
    role       : CrewRole not null;
}

entity Expenses : cuid, managed {
    report        : Association to FlightReports not null;
    leg           : Association to FlightLegs;

    @assert.target
    category      : Association to ExpenseCategories not null;

    expenseDate   : Date not null;
    description   : String(255);
    supplier      : String(160);
    receiptNumber : String(80);

    @assert.range: [(0), _]
    originalAmount   : Decimal(15,2) not null;

    @assert.target
    originalCurrency : Association to Currencies not null;

    exchangeRate : Decimal(18,6);
    amountUSD    : Decimal(15,2);
    amountVES    : Decimal(15,2);

    @assert.range: [(0), _]
    fuelQuantityLiters : Decimal(12,2);

    attachments : Composition of many Attachments;
}
