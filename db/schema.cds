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
}

type ReportAuditStatus : String enum {
    notStarted     = 'NOT_STARTED';
    pending        = 'PENDING';
    actionRequired = 'ACTION_REQUIRED';
    approved       = 'APPROVED';
}

type ExpenseAuditStatus : String enum {
    draft           = 'DRAFT';
    pending         = 'PENDING';
    approved        = 'APPROVED';
    needsCorrection = 'NEEDS_CORRECTION';
}

type CrewRole : String enum {
    pic      = 'PIC';
    sic      = 'SIC';
    other    = 'OTHER';
};

entity CrewRoles {
    key code : CrewRole;
    name     : String(50) not null;
    sortOrder : Integer not null;
}

@assert.unique: {
    code: [code]
}
entity Organizations : cuid, managed {
    code   : String(20) not null;
    name   : String(120) not null;
    active : Boolean not null default true;
}

@assert.unique: {
    organizationUser: [organization, userId]
}
entity OrganizationMembers : cuid, managed {
    organization : Association to Organizations not null;
    userId       : String(255) not null;
    active       : Boolean not null default true;
}

entity ReportNumberRanges {
    key organization : Association to Organizations;
    key year         : Integer;
    nextNumber       : Integer not null default 1;
}

@assert.unique: {
    organizationRegistration: [organization, registration]
}
entity Aircraft : cuid, managed {
    organization : Association to Organizations not null;
    registration : String(20) not null;
    description  : String(100);
}

entity CrewMembers : cuid, managed {
    organization : Association to Organizations not null;
    firstName : String(80) not null;
    lastName  : String(80) not null;
    fullName  : String(161) = firstName || ' ' || lastName;
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
    organizationReportNumber: [organization, reportNumber]
}
entity FlightReports : cuid, managed {
    organization   : Association to Organizations not null;
    // Assigned transactionally when the report is submitted.
    reportNumber    : String(30);

    // UI identifier available before the official number is assigned.
    displayTitle    : String(160) = case
        when reportNumber is not null then reportNumber
        when aircraft.registration is not null then concat('Draft - ', aircraft.registration)
        else 'Draft Flight Report'
    end;

    @assert.target
    aircraft        : Association to Aircraft not null;

    requesterName   : String(160);

    // Persisted operational summary, calculated from the report's flight legs.
    firstFlightDate  : Date;
    lastFlightDate   : Date;
    totalFlightHours : Decimal(8,2) not null default 0;

    // Business workflow state-not the Fiori draft state.
    status          : FlightReportStatus not null default #draft;
    auditStatus     : ReportAuditStatus not null default #notStarted;
    // Maintained by workflow handlers so the UI can expose valid bulk actions.
    pendingExpenseCount : Integer not null default 0;

    submittedAt     : Timestamp;
    submittedBy     : String(255);

    notes           : LargeString;

    legs            : Composition of many FlightLegs 
                      on legs.report = $self;

    crew            : Composition of many CrewAssignments
                      on crew.report = $self;

    expenses        : Composition of many Expenses
                      on expenses.report = $self;

    statusHistory   : Composition of many FlightReportHistory
                      on statusHistory.report = $self;
}

entity FlightReportHistory : cuid, managed {
    report : Association to FlightReports not null;

    fromStatus : FlightReportStatus;
    toStatus   : FlightReportStatus not null;

    comment : String(1000);
}

@assert.unique: {
    reportSequence: [report, sequence]
}
entity FlightLegs : cuid, managed {
    report                 : Association to FlightReports not null;

    @assert.range: [(0), _]
    sequence               : Integer not null;
    sequenceText           : String(10) = cast(sequence as String);

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

@assert.unique: {
    reportCrewMember: [report, crewMember]
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

    auditStatus  : ExpenseAuditStatus not null default #draft;

    submittedForAuditAt : Timestamp;

    auditedAt : Timestamp;
    auditedBy : String(255);

    correctionReason : String(1000);

    addedAfterReportSubmission : Boolean not null default false;

    auditHistory : Composition of many ExpenseAuditHistory
                on auditHistory.expense = $self;

    @assert.range: [(0), _]
    fuelQuantityLiters : Decimal(12,2);

    attachments : Composition of many Attachments;
}

entity ExpenseAuditHistory : cuid, managed {
    expense : Association to Expenses not null;

    fromStatus : ExpenseAuditStatus;
    toStatus   : ExpenseAuditStatus not null;

    comment : String(1000);
}

annotate FlightReports with {
    modifiedAt @odata.etag;
};

annotate Expenses with {
    modifiedAt @odata.etag;
};
