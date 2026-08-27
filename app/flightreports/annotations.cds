using ExpenseService as service from '../../srv/expense-service';

annotate service.FlightReports with @(

    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Flight Report',
        TypeNamePlural : 'Flight Reports',
        Title : {
            $Type : 'UI.DataField',
            Value : reportNumber,
        },
        Description : {
            $Type : 'UI.DataField',
            Value : requesterName,
        },
    },

    UI.SelectionFields : [
        reportNumber,
        aircraft_ID,
        requesterName,
        status,
        auditStatus
    ],

    UI.Identification : [
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Refresh Exchange Rates',
            Action : 'ExpenseService.refreshExchangeRates',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Submit Report',
            Action : 'ExpenseService.submit',
            Criticality : #Positive,
        },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Add Late Expense',
            Action : 'ExpenseService.addExpense',
        },
    ],

    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'Report Number',
                Value : reportNumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Aircraft',
                Value : aircraft_ID,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Flight Requester',
                Value : requesterName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Expense Audit Status',
                Value : auditStatus,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Notes',
                Value : notes,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneralInformation',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'FlightLegs',
            Label : 'Flight Legs',
            Target : 'legs/@UI.LineItem',
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'Crew',
            Label : 'Crew',
            Target : 'crew/@UI.LineItem',
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'Expenses',
            Label : 'Expenses',
            Target : 'expenses/@UI.LineItem',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'Report Number',
            Value : reportNumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Flight Requester',
            Value : requesterName,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Status',
            Value : status,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Expense Audit Status',
            Value : auditStatus,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Notes',
            Value : notes,
        },
    ],
);

annotate service.FlightReports with {

    aircraft @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Aircraft',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : aircraft_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'registration',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description',
            },
        ],
    }
};

annotate service.FlightLegs with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Leg', Value : sequence },
        { $Type : 'UI.DataField', Label : 'Date', Value : flightDate },
        { $Type : 'UI.DataField', Label : 'Origin', Value : originAirportCode },
        { $Type : 'UI.DataField', Label : 'Destination', Value : destinationAirportCode },
        { $Type : 'UI.DataField', Label : 'Flight Hours', Value : flightHours },
        { $Type : 'UI.DataField', Label : 'Initial Hourmeter', Value : hourMeterStart },
        { $Type : 'UI.DataField', Label : 'Final Hourmeter', Value : hourMeterEnd },
    ]
);

annotate service.CrewAssignments with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Crew Member', Value : crewMember_ID },
        { $Type : 'UI.DataField', Label : 'Role', Value : role },
    ]
);

annotate service.Expenses with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Date', Value : expenseDate },
        { $Type : 'UI.DataField', Label : 'Category', Value : category_ID },
        { $Type : 'UI.DataField', Label : 'Description', Value : description },
        { $Type : 'UI.DataField', Label : 'Amount', Value : originalAmount },
        { $Type : 'UI.DataField', Label : 'Currency', Value : originalCurrency_code },
        { $Type : 'UI.DataField', Label : 'Amount (USD)', Value : amountUSD },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
    ]
);

annotate service.FlightReports with {
    organization  @UI.Hidden;
    aircraft      @title : 'Aircraft';
    reportNumber  @(
        title : 'Report Number',
        Common.FieldControl : #ReadOnly
    );
    requesterName @title : 'Flight Requester';
    status        @title : 'Report Status';
    auditStatus   @title : 'Expense Audit Status';
    notes         @title : 'Notes';
};

annotate service.FlightReports actions {
    refreshExchangeRates @Core.OperationAvailable : ($self.status = 'DRAFT');
    submit               @Core.OperationAvailable : ($self.status = 'DRAFT');
    addExpense           @Core.OperationAvailable : ($self.status = 'SUBMITTED');
};

annotate service.FlightLegs with {
    sequence               @title : 'Leg Number';
    flightDate             @title : 'Flight Date';
    originAirportCode      @title : 'Origin (ICAO)';
    destinationAirportCode @title : 'Destination (ICAO)';
    flightHours            @title : 'Flight Hours';
    hourMeterStart         @title : 'Initial Hourmeter';
    hourMeterEnd           @title : 'Final Hourmeter';
};

annotate service.CrewAssignments with {
    crewMember @(
        title : 'Crew Member',
        Common.ValueList : {
            CollectionPath : 'CrewMembers',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : crewMember_ID,
                    ValueListProperty : 'ID',
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'firstName',
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'lastName',
                },
            ],
        }
    );
    role @title : 'Role';
};

annotate service.Expenses with {
    expenseDate                  @title : 'Expense Date';
    category @(
        title : 'Category',
        Common.ValueList : {
            CollectionPath : 'ExpenseCategories',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : category_ID,
                    ValueListProperty : 'ID',
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'code',
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name',
                },
            ],
        }
    );
    description                  @title : 'Description';
    supplier                     @title : 'Supplier';
    receiptNumber                @title : 'Receipt Number';
    originalAmount               @title : 'Amount';
    originalCurrency @title : 'Currency';
    exchangeRate                 @title : 'Exchange Rate';
    amountUSD                    @title : 'Amount (USD)';
    amountVES                    @title : 'Amount (VES)';
    auditStatus                  @title : 'Audit Status';
    fuelQuantityLiters           @title : 'Fuel Quantity (L)';
    addedAfterReportSubmission   @title : 'Added After Submission';
};

