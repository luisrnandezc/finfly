using AdminService as admin from '../../srv/admin-service';

annotate admin with @Capabilities.FilterFunctions : ['tolower'];

annotate admin.Users with @(UI.SelectionPresentationVariant #AllUsers : {
    Text : 'Personnel',
    SelectionVariant : { Text : 'Personnel' },
    PresentationVariant : { SortOrder : [{ Property : fullName }] }
});

annotate admin.Aircraft with @(UI.SelectionPresentationVariant #AllAircraft : {
    Text : 'Aircraft',
    SelectionVariant : { Text : 'Aircraft' },
    PresentationVariant : { SortOrder : [{ Property : registration }] }
});

annotate admin.FlightReports with @(UI.SelectionPresentationVariant #AllReports : {
    Text : 'Flight Reports',
    SelectionVariant : { Text : 'Flight Reports' },
    PresentationVariant : { SortOrder : [{ Property : modifiedAt, Descending : true }] }
});

annotate admin.Expenses with @(UI.SelectionPresentationVariant #AllExpenses : {
    Text : 'Expenses',
    SelectionVariant : { Text : 'Expenses' },
    PresentationVariant : { SortOrder : [{ Property : modifiedAt, Descending : true }] }
});

annotate admin.Users with @(
    Capabilities.InsertRestrictions : { Insertable : true },
    Capabilities.DeleteRestrictions : { Deletable : false },
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Person',
        TypeNamePlural : 'Personnel',
        Title : { $Type : 'UI.DataField', Value : fullName },
        Description : { $Type : 'UI.DataField', Value : userId }
    },
    UI.SelectionFields : [fullName, nationalId, userId, isPilot, isAuditor, isAdmin, active],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Full Name', Value : fullName, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'National ID', Value : nationalId, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Login ID', Value : userId, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Pilot', Value : isPilot, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Auditor', Value : isAuditor, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Administrator', Value : isAdmin, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataField', Label : 'Active', Value : active, ![@UI.Importance] : #High }
    ],
    UI.Identification : [
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Deactivate Person',
            Action : 'AdminService.deactivateUser',
            Criticality : #Negative
        },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Reactivate Person',
            Action : 'AdminService.reactivateUser',
            Criticality : #Positive
        }
    ],
    UI.FieldGroup #PersonalDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'National ID', Value : nationalId },
            { $Type : 'UI.DataField', Label : 'First Name', Value : firstName },
            { $Type : 'UI.DataField', Label : 'Last Name', Value : lastName },
            { $Type : 'UI.DataField', Label : 'Login ID', Value : userId },
            { $Type : 'UI.DataField', Label : 'Active', Value : active }
        ]
    },
    UI.FieldGroup #ApplicationRoles : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Pilot', Value : isPilot },
            { $Type : 'UI.DataField', Label : 'Auditor', Value : isAuditor },
            { $Type : 'UI.DataField', Label : 'Administrator', Value : isAdmin }
        ]
    },
    UI.FieldGroup #ProfessionalDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Position', Value : positionTitle },
            { $Type : 'UI.DataField', Label : 'Pilot License', Value : licenseType },
            { $Type : 'UI.DataField', Label : 'Total Flight Hours', Value : totalFlightHours }
        ]
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'PersonalDetails',
            Label : 'Personal Details',
            Target : '@UI.FieldGroup#PersonalDetails'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'ApplicationRoles',
            Label : 'Application Roles',
            Target : '@UI.FieldGroup#ApplicationRoles'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'ProfessionalDetails',
            Label : 'Professional Details',
            Target : '@UI.FieldGroup#ProfessionalDetails'
        }
    ]
);

annotate admin.Users with {
    ID           @UI.Hidden;
    organization @UI.Hidden;
    fullName     @title : 'Name';
    nationalId   @title : 'National ID';
    userId       @title : 'Login ID';
    firstName    @title : 'First Name';
    lastName     @title : 'Last Name';
    isPilot      @title : 'Pilot';
    isAuditor    @title : 'Auditor';
    isAdmin      @title : 'Administrator';
    positionTitle @title : 'Position';
    totalFlightHours @title : 'Total Flight Hours';
    active       @title : 'Active';
    licenseType @(
        title : 'Pilot License',
        Common.ValueListWithFixedValues : true,
        Common.ValueList : {
            CollectionPath : 'PilotLicenseTypes',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : licenseType,
                    ValueListProperty : 'code'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name'
                }
            ]
        }
    );
};

annotate admin.Aircraft with @(
    Capabilities.InsertRestrictions : { Insertable : true },
    Capabilities.DeleteRestrictions : { Deletable : false },
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Aircraft',
        TypeNamePlural : 'Aircraft',
        Title : { $Type : 'UI.DataField', Value : registration },
        Description : { $Type : 'UI.DataField', Value : model }
    },
    UI.SelectionFields : [registration, manufacturer, model, aircraftType, active],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Registration', Value : registration, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Model', Value : model, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Default PIC', Value : defaultPIC_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Default SIC', Value : defaultSIC_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Total Hours', Value : currentFlightHours, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Total Cycles', Value : totalCycles, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Active', Value : active, ![@UI.Importance] : #High }
    ],
    UI.Identification : [
        {
            $Type : 'UI.DataFieldForAction', Label : 'Deactivate Aircraft',
            Action : 'AdminService.deactivateAircraft', Criticality : #Negative
        },
        {
            $Type : 'UI.DataFieldForAction', Label : 'Reactivate Aircraft',
            Action : 'AdminService.reactivateAircraft', Criticality : #Positive
        }
    ],
    UI.FieldGroup #AircraftDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Registration', Value : registration },
            { $Type : 'UI.DataField', Label : 'Manufacturer', Value : manufacturer },
            { $Type : 'UI.DataField', Label : 'Model', Value : model },
            { $Type : 'UI.DataField', Label : 'Serial Number', Value : serialNumber },
            { $Type : 'UI.DataField', Label : 'Aircraft Type', Value : aircraftType },
            { $Type : 'UI.DataField', Label : 'Description', Value : description },
            { $Type : 'UI.DataField', Label : 'Active', Value : active }
        ]
    },
    UI.FieldGroup #DefaultCrew : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Default PIC', Value : defaultPIC_ID },
            { $Type : 'UI.DataField', Label : 'Default SIC', Value : defaultSIC_ID }
        ]
    },
    UI.FieldGroup #Utilization : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Total Hours', Value : currentFlightHours },
            { $Type : 'UI.DataField', Label : 'Total Cycles', Value : totalCycles }
        ]
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet', ID : 'AircraftDetails',
            Label : 'Aircraft Details', Target : '@UI.FieldGroup#AircraftDetails'
        },
        {
            $Type : 'UI.ReferenceFacet', ID : 'DefaultCrew',
            Label : 'Default Crew', Target : '@UI.FieldGroup#DefaultCrew'
        },
        {
            $Type : 'UI.ReferenceFacet', ID : 'Utilization',
            Label : 'Utilization', Target : '@UI.FieldGroup#Utilization'
        }
    ]
);

annotate admin.Aircraft with {
    ID           @UI.Hidden;
    organization @UI.Hidden;
    registration @title : 'Registration';
    manufacturer @title : 'Manufacturer';
    model        @title : 'Model';
    serialNumber @title : 'Serial Number';
    description  @title : 'Description';
    currentFlightHours @title : 'Current Flight Hours';
    totalCycles  @title : 'Total Cycles';
    active       @title : 'Active';
    aircraftType @(
        title : 'Aircraft Type',
        Common.Text : aircraftTypeDetails.name,
        Common.TextArrangement : #TextOnly,
        Common.ValueListWithFixedValues : true,
        Common.ValueList : {
            CollectionPath : 'AircraftTypes',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : aircraftType,
                    ValueListProperty : 'code'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name'
                }
            ]
        }
    );
    defaultPIC @(
        title : 'Default PIC',
        Common.Text : defaultPIC.fullName,
        Common.TextArrangement : #TextOnly,
        Common.ValueList : {
            CollectionPath : 'Pilots',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : defaultPIC_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'nationalId'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'fullName'
                }
            ]
        }
    );
    defaultSIC @(
        title : 'Default SIC',
        Common.Text : defaultSIC.fullName,
        Common.TextArrangement : #TextOnly,
        Common.ValueList : {
            CollectionPath : 'Pilots',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : defaultSIC_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'nationalId'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'fullName'
                }
            ]
        }
    );
};

annotate admin.Pilots with {
    ID         @UI.Hidden;
    nationalId @title : 'National ID';
    fullName   @title : 'Full Name';
};

annotate admin.FlightReports with @(
    Capabilities.FilterRestrictions : { FilterExpressionRestrictions : [
        { Property : reportNumber, AllowedExpressions : 'SearchExpression' },
        { Property : requesterName, AllowedExpressions : 'SearchExpression' }
    ] },
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType', TypeName : 'Flight Report',
        TypeNamePlural : 'Flight Reports',
        Title : { $Type : 'UI.DataField', Value : displayTitle },
        Description : { $Type : 'UI.DataField', Value : requesterName }
    },
    UI.SelectionFields : [reportNumber, aircraft_ID, requesterName, status, reviewStatus],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Report', Value : reportNumber },
        { $Type : 'UI.DataField', Label : 'Aircraft', Value : aircraft_ID },
        { $Type : 'UI.DataField', Label : 'Requester', Value : requesterName },
        { $Type : 'UI.DataField', Label : 'Report Status', Value : status },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
        { $Type : 'UI.DataField', Label : 'Total Hours', Value : totalFlightHours },
        {
            $Type : 'UI.DataFieldForAction', Label : 'Approve All Expenses',
            Action : 'AdminService.approveAllExpenses', Inline : true,
            Criticality : #Positive
        }
    ],
    UI.Identification : [{
        $Type : 'UI.DataFieldForAction', Label : 'Approve All Expenses',
        Action : 'AdminService.approveAllExpenses', Criticality : #Positive
    }],
    UI.FieldGroup #ReportDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Report Number', Value : reportNumber },
            { $Type : 'UI.DataField', Label : 'Aircraft', Value : aircraft_ID },
            { $Type : 'UI.DataField', Label : 'Flight Requester', Value : requesterName },
            { $Type : 'UI.DataField', Label : 'Report Status', Value : status },
            { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
            { $Type : 'UI.DataField', Label : 'First Flight', Value : firstFlightDate },
            { $Type : 'UI.DataField', Label : 'Last Flight', Value : lastFlightDate },
            { $Type : 'UI.DataField', Label : 'Total Flight Hours', Value : totalFlightHours },
            { $Type : 'UI.DataField', Label : 'Submitted At', Value : submittedAt },
            { $Type : 'UI.DataField', Label : 'Submitted By', Value : submittedBy },
            { $Type : 'UI.DataField', Label : 'Notes', Value : notes }
        ]
    },
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'ReportDetails', Label : 'Report Details', Target : '@UI.FieldGroup#ReportDetails' },
        { $Type : 'UI.ReferenceFacet', ID : 'Expenses', Label : 'Expenses', Target : 'expenses/@UI.LineItem#ReportExpenses' },
        { $Type : 'UI.ReferenceFacet', ID : 'FlightLegs', Label : 'Flight Legs', Target : 'legs/@UI.LineItem' },
        { $Type : 'UI.ReferenceFacet', ID : 'Crew', Label : 'Crew', Target : 'crew/@UI.LineItem' }
    ]
);

annotate admin.Expenses with @(
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType', TypeName : 'Expense', TypeNamePlural : 'Expenses',
        Title : { $Type : 'UI.DataField', Value : category.name },
        Description : { $Type : 'UI.DataField', Value : report.reportNumber }
    },
    UI.SelectionFields : [reviewStatus, report_ID, expenseDate, category_ID, supplier],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Report', Value : report_ID },
        { $Type : 'UI.DataField', Label : 'Date', Value : expenseDate },
        { $Type : 'UI.DataField', Label : 'Category', Value : category_ID },
        { $Type : 'UI.DataField', Label : 'Amount', Value : originalAmount },
        { $Type : 'UI.DataField', Label : 'Currency', Value : originalCurrency_code },
        { $Type : 'UI.DataField', Label : 'Supplier', Value : supplier },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
        { $Type : 'UI.DataFieldForAction', Label : 'Approve', Action : 'AdminService.approveExpense', Inline : true, Criticality : #Positive },
        { $Type : 'UI.DataFieldForAction', Label : 'Request Correction', Action : 'AdminService.requestExpenseCorrection', Inline : true, Criticality : #Negative }
    ],
    UI.LineItem #ReportExpenses : [
        { $Type : 'UI.DataField', Label : 'Date', Value : expenseDate },
        { $Type : 'UI.DataField', Label : 'Category', Value : category_ID },
        { $Type : 'UI.DataField', Label : 'Amount', Value : originalAmount },
        { $Type : 'UI.DataField', Label : 'Currency', Value : originalCurrency_code },
        { $Type : 'UI.DataField', Label : 'Supplier', Value : supplier },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
        { $Type : 'UI.DataField', Label : 'Correction Reason', Value : correctionReason },
        { $Type : 'UI.DataFieldForAction', Label : 'Approve', Action : 'AdminService.approveExpense', Inline : true, Criticality : #Positive },
        { $Type : 'UI.DataFieldForAction', Label : 'Request Correction', Action : 'AdminService.requestExpenseCorrection', Inline : true, Criticality : #Negative }
    ],
    UI.Identification : [
        { $Type : 'UI.DataFieldForAction', Label : 'Approve Expense', Action : 'AdminService.approveExpense', Criticality : #Positive },
        { $Type : 'UI.DataFieldForAction', Label : 'Request Correction', Action : 'AdminService.requestExpenseCorrection', Criticality : #Negative }
    ],
    UI.FieldGroup #ExpenseDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Report', Value : report_ID },
            { $Type : 'UI.DataField', Label : 'Flight Leg', Value : leg_ID },
            { $Type : 'UI.DataField', Label : 'Expense Date', Value : expenseDate },
            { $Type : 'UI.DataField', Label : 'Category', Value : category_ID },
            { $Type : 'UI.DataField', Label : 'Amount', Value : originalAmount },
            { $Type : 'UI.DataField', Label : 'Currency', Value : originalCurrency_code },
            { $Type : 'UI.DataField', Label : 'Supplier', Value : supplier },
            { $Type : 'UI.DataField', Label : 'Receipt Number', Value : receiptNumber },
            { $Type : 'UI.DataField', Label : 'Description', Value : description },
            { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
            { $Type : 'UI.DataField', Label : 'Correction Reason', Value : correctionReason }
        ]
    },
    UI.Facets : [
        { $Type : 'UI.ReferenceFacet', ID : 'ExpenseDetails', Label : 'Expense Details', Target : '@UI.FieldGroup#ExpenseDetails' },
        { $Type : 'UI.ReferenceFacet', ID : 'AuditHistory', Label : 'Audit History', Target : 'auditHistory/@UI.LineItem' }
    ]
);

annotate admin.FlightLegs with @(UI.LineItem : [
    { $Type : 'UI.DataField', Label : 'Leg', Value : sequence },
    { $Type : 'UI.DataField', Label : 'Date', Value : flightDate },
    { $Type : 'UI.DataField', Label : 'Origin', Value : originAirportCode },
    { $Type : 'UI.DataField', Label : 'Destination', Value : destinationAirportCode },
    { $Type : 'UI.DataField', Label : 'Flight Hours', Value : flightHours }
]);

annotate admin.CrewAssignments with @(UI.LineItem : [
    { $Type : 'UI.DataField', Label : 'Crew Member', Value : crewMember_ID },
    { $Type : 'UI.DataField', Label : 'Role', Value : role }
]);

annotate admin.ExpenseAuditHistory with @(UI.LineItem : [
    { $Type : 'UI.DataField', Label : 'From', Value : fromStatus },
    { $Type : 'UI.DataField', Label : 'To', Value : toStatus },
    { $Type : 'UI.DataField', Label : 'Comment', Value : comment },
    { $Type : 'UI.DataField', Label : 'Changed At', Value : createdAt },
    { $Type : 'UI.DataField', Label : 'Changed By', Value : createdBy }
]);

annotate admin.FlightReports with {
    aircraft @(
        title : 'Aircraft',
        Common.Text : aircraft.registration,
        Common.TextArrangement : #TextOnly,
        Common.ValueList : {
            CollectionPath : 'Aircraft',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : aircraft_ID,
                    ValueListProperty : 'ID'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'registration'
                }
            ]
        }
    );
    auditStatus @(
        Common.Text : auditStatusDetails.name,
        Common.TextArrangement : #TextOnly
    );
};

annotate admin.Expenses with {
    report @(
        title : 'Flight Report',
        Common.Text : report.displayTitle,
        Common.TextArrangement : #TextOnly
    );
    leg @(
        title : 'Flight Leg',
        Common.Text : leg.sequenceText,
        Common.TextArrangement : #TextOnly
    );
    category @(
        title : 'Category',
        Common.Text : category.name,
        Common.TextArrangement : #TextOnly
    );
    originalCurrency @(
        title : 'Currency',
        Common.Text : originalCurrency.name,
        Common.TextArrangement : #TextOnly
    );
};

annotate admin.CrewAssignments with {
    crewMember @(
        title : 'Crew Member',
        Common.Text : crewMember.fullName,
        Common.TextArrangement : #TextOnly
    );
};

annotate admin.Users actions {
    deactivateUser @Core.OperationAvailable : ($self.active = true);
    reactivateUser @Core.OperationAvailable : ($self.active = false);
};

annotate admin.Aircraft actions {
    deactivateAircraft @Core.OperationAvailable : ($self.active = true);
    reactivateAircraft @Core.OperationAvailable : ($self.active = false);
};

annotate admin.Expenses actions {
    approveExpense @Core.OperationAvailable : ($self.auditStatus = 'PENDING');
    requestExpenseCorrection @Core.OperationAvailable : ($self.auditStatus = 'PENDING');
};

annotate admin.FlightReports actions {
    approveAllExpenses @(
        Common.IsActionCritical : true,
        Core.OperationAvailable : ($self.pendingExpenseCount > 0)
    );
};

annotate admin.PilotLicenseTypes with @(UI.PresentationVariant : { SortOrder : [{ Property : sortOrder }] });
annotate admin.AircraftTypes with @(UI.PresentationVariant : { SortOrder : [{ Property : sortOrder }] });
