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
            Label : 'Aircraft',
            Value : aircraft_ID,
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
        { $Type : 'UI.DataField', Label : 'Leg', Value : sequence, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataField', Label : 'Date', Value : flightDate, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'From', Value : originAirportCode, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'To', Value : destinationAirportCode, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Hours', Value : flightHours, ![@UI.Importance] : #High },
    ]
);

annotate service.CrewAssignments with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Crew Member', Value : crewMember_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Role', Value : role, ![@UI.Importance] : #High },
    ]
);

annotate service.Expenses with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Date', Value : expenseDate, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Category', Value : category_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Description', Value : description, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataField', Label : 'Amount', Value : originalAmount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Currency', Value : originalCurrency_code, ![@UI.Importance] : #High },
    ]
);

annotate service.FlightReports with {
    organization  @UI.Hidden;
    aircraft @(
        title : 'Aircraft',
        Common.Text : aircraft.registration,
        Common.TextArrangement : #TextOnly
    );
    reportNumber  @(
        title : 'Report Number',
        Common.FieldControl : #ReadOnly
    );
    requesterName @title : 'Flight Requester';
    status @(
        title : 'Report Status',
        UI.ValueCriticality : [
            { Value : 'DRAFT', Criticality : #Information },
            { Value : 'SUBMITTED', Criticality : #Positive },
        ]
    );
    auditStatus @(
        title : 'Expense Audit Status',
        UI.ValueCriticality : [
            { Value : 'NOT_STARTED', Criticality : #Neutral },
            { Value : 'PENDING', Criticality : #Information },
            { Value : 'ACTION_REQUIRED', Criticality : #Negative },
            { Value : 'APPROVED', Criticality : #Positive },
        ]
    );
    notes @(
        title : 'Notes',
        UI.MultiLineText
    );
};

annotate service.FlightReports actions {
    refreshExchangeRates @Core.OperationAvailable : ($self.status = 'DRAFT');
    submit               @Core.OperationAvailable : ($self.status = 'DRAFT');
    addExpense           @Core.OperationAvailable : ($self.status = 'SUBMITTED');
};

annotate service.FlightLegs with {
    sequence               @(title : 'Leg Number', Common.FieldControl : #ReadOnly);
    flightDate             @title : 'Flight Date';
    originAirportCode      @title : 'Origin (ICAO)';
    destinationAirportCode @title : 'Destination (ICAO)';
    flightHours            @title : 'Flight Hours';
};

annotate service.CrewAssignments with {
    crewMember @(
        title : 'Crew Member',
        Common.Text: crewMember.fullName,
        Common.TextArrangement : #TextOnly,
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
                    ValueListProperty : 'fullName',
                },
            ],
        }
    );
    role @(
        title : 'Role',
        Common.ValueListWithFixedValues : true,
        Common.ValueList : {
            CollectionPath : 'CrewRoles',
            PresentationVariantQualifier : 'RoleOrder',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : role,
                    ValueListProperty : 'code'
                }
            ]
        }
    );
};

annotate service.CrewRoles with @(
    UI.PresentationVariant #RoleOrder : {
        SortOrder : [
            {
                Property : sortOrder,
                Descending : false
            }
        ]
    }
);

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
    originalCurrency             @title : 'Currency';
    exchangeRate                 @title : 'Exchange Rate';
    amountUSD                    @title : 'Amount (USD)';
    amountVES                    @title : 'Amount (VES)';
    auditStatus                  @title : 'Audit Status';
    fuelQuantityLiters           @title : 'Fuel Quantity (L)';
    addedAfterReportSubmission   @title : 'Added After Submission';
};

annotate service.Aircraft with {
    ID @UI.Hidden;
};

annotate service.CrewMembers with {
    ID @UI.Hidden;
};

annotate service.ExpenseCategories with {
    ID @UI.Hidden;
};

