namespace finfly;

using {
    cuid,
    managed,
    sap.common.Currencies
} from '@sap/cds/common';

using {
    Attatchments
} from '@cap-js/attatchments';

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

entity Aircraft : cuid, managed {
    registration : String(20) not null;
    description  : String(100);
}

entity CrewMembers : cuid, managed {
    firstName : String(80) not null;
    lastName  : String(80) not null;
    active    : Boolean default true;
}

entity ExpenseCategories : cuid, managed {
    code        : String(30) not null;
    name        : localized String(100) not null;
    description : localized String(255);
    active      : Boolean default true;
}

