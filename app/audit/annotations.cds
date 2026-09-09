using AuditService as audit from '../../srv/audit-service';

// =============================================================================
// Expense UI
// These annotations are reused by the report-specific table and the future
// cross-report expense queue.
// =============================================================================

// Entity identity is reusable metadata. Fiori can consume it in Object Page
// headers, navigation context, dialogs, and singular/plural entity labels.
annotate audit.Expenses with @(
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Expense',
        TypeNamePlural : 'Expenses',
        Title : { $Type : 'UI.DataField', Value : category.name },
        Description : { $Type : 'UI.DataField', Value : report.reportNumber }
    }
);

// Page-specific metadata for the future global expense queue: SelectionFields
// builds its filter bar, while the qualified variant supplies its initial view.
annotate audit.Expenses with @(
    UI.SelectionFields : [
        auditStatus,
        report_ID,
        expenseDate,
        category_ID,
        originalCurrency_code,
        addedAfterReportSubmission
    ],
    UI.SelectionPresentationVariant #PendingExpenses : {
        Text : 'Pending Expenses',
        SelectionVariant : {
            Text : 'Pending Expenses',
            SelectOptions : [{
                PropertyName : auditStatus,
                Ranges : [{
                    Sign : #I,
                    Option : #EQ,
                    Low : 'PENDING'
                }]
            }]
        },
        PresentationVariant : {
            SortOrder : [{ Property : submittedForAuditAt, Descending : true }]
        }
    },
    // Cross-report history without a status restriction. The filter bar lets
    // the auditor narrow this complete set as needed.
    UI.SelectionPresentationVariant #AllExpenses : {
        Text : 'All Expenses',
        SelectionVariant : {
            Text : 'All Expenses'
        },
        PresentationVariant : {
            SortOrder : [{ Property : submittedForAuditAt, Descending : true }]
        }
    }
);

// The unqualified LineItem is Fiori's default table for Expenses.
// The #ReportExpenses qualifier is explicitly selected by the report facet,
// allowing that embedded table to use a more focused column set.
annotate audit.Expenses with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Report', Value : report_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Aircraft', Value : report.aircraft_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Date', Value : expenseDate, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Category', Value : category_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Amount', Value : originalAmount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Currency', Value : originalCurrency_code, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Supplier', Value : supplier, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataField', Label : 'Receipt Number', Value : receiptNumber, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Late Addition', Value : addedAfterReportSubmission, ![@UI.Importance] : #Medium },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Approve',
            Action : 'AuditService.approveExpense',
            Inline : true,
            Criticality : #Positive
        },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Request Correction',
            Action : 'AuditService.requestExpenseCorrection',
            Inline : true,
            Criticality : #Negative
        }
    ],
    UI.LineItem #ReportExpenses : [
        { $Type : 'UI.DataField', Label : 'Date', Value : expenseDate, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Category', Value : category_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Flight Leg', Value : leg_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Amount', Value : originalAmount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Currency', Value : originalCurrency_code, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Supplier', Value : supplier, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataField', Label : 'Receipt Number', Value : receiptNumber, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Correction Reason', Value : correctionReason, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Late Addition', Value : addedAfterReportSubmission, ![@UI.Importance] : #Medium },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Approve',
            Action : 'AuditService.approveExpense',
            Inline : true,
            Criticality : #Positive,
            ![@UI.Importance] : #High
        },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Request Correction',
            Action : 'AuditService.requestExpenseCorrection',
            Inline : true,
            Criticality : #Negative,
            ![@UI.Importance] : #High
        }
    ]
);

// Identification renders Object Page header actions. FieldGroup defines the
// detail fields, and Facets places that group and history into page sections.
annotate audit.Expenses with @(
    UI.Identification : [
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Approve Expense',
            Action : 'AuditService.approveExpense',
            Criticality : #Positive
        },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Request Correction',
            Action : 'AuditService.requestExpenseCorrection',
            Criticality : #Negative
        }
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
            { $Type : 'UI.DataField', Label : 'Correction Reason', Value : correctionReason },
            { $Type : 'UI.DataField', Label : 'Added After Submission', Value : addedAfterReportSubmission }
        ]
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'ExpenseDetails',
            Label : 'Expense Details',
            Target : '@UI.FieldGroup#ExpenseDetails'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'AuditHistory',
            Label : 'Audit History',
            Target : 'auditHistory/@UI.LineItem'
        }
    ]
);

// =============================================================================
// Flight Report UI
// Flight Reports are the auditor application's main work queue.
// =============================================================================

// Entity identity is kept separate because HeaderInfo is reusable Fiori
// metadata, even though its most visible use is the Object Page header.
annotate audit.FlightReports with @(
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Flight Report',
        TypeNamePlural : 'Flight Reports',
        Title : { $Type : 'UI.DataField', Value : reportNumber },
        Description : { $Type : 'UI.DataField', Value : requesterName }
    }
);

// Page-specific metadata for the landing queue: SelectionFields builds the
// filter bar; the qualified variant applies the initial filter and sort order.
annotate audit.FlightReports with @(
    UI.SelectionFields : [
        reportNumber,
        auditStatus,
        aircraft_ID,
        requesterName,
        firstFlightDate,
        lastFlightDate
    ],
    UI.SelectionPresentationVariant #RequiringAudit : {
        Text : 'Reports Requiring Audit',
        SelectionVariant : {
            Text : 'Reports Requiring Audit',
            SelectOptions : [{
                PropertyName : auditStatus,
                Ranges : [{ Sign : #I, Option : #NE, Low : 'APPROVED' }]
            }]
        },
        PresentationVariant : {
            SortOrder : [{ Property : submittedAt, Descending : true }]
        }
    },
    // Historical view: only fully approved reports, newest audit changes first.
    UI.SelectionPresentationVariant #ApprovedReports : {
        Text : 'Approved Reports',
        SelectionVariant : {
            Text : 'Approved Reports',
            SelectOptions : [{
                PropertyName : auditStatus,
                Ranges : [{ Sign : #I, Option : #EQ, Low : 'APPROVED' }]
            }]
        },
        PresentationVariant : {
            SortOrder : [{ Property : modifiedAt, Descending : true }]
        }
    }
);

// Identification supplies the Object Page header action. FieldGroup contains
// the summary, while Facets determines the visible sections and their order.
annotate audit.FlightReports with @(
    UI.Identification : [{
        $Type : 'UI.DataFieldForAction',
        Label : 'Approve All Expenses',
        Action : 'AuditService.approveAllExpenses',
        Criticality : #Positive
    }],
    UI.FieldGroup #ReportDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Report Number', Value : reportNumber },
            { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
            { $Type : 'UI.DataField', Label : 'Aircraft', Value : aircraft_ID },
            { $Type : 'UI.DataField', Label : 'Flight Requester', Value : requesterName },
            { $Type : 'UI.DataField', Label : 'First Flight', Value : firstFlightDate },
            { $Type : 'UI.DataField', Label : 'Last Flight', Value : lastFlightDate },
            { $Type : 'UI.DataField', Label : 'Total Flight Hours', Value : totalFlightHours },
            { $Type : 'UI.DataField', Label : 'Submitted At', Value : submittedAt },
            { $Type : 'UI.DataField', Label : 'Submitted By', Value : submittedBy },
            { $Type : 'UI.DataField', Label : 'Notes', Value : notes }
        ]
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'ReportDetails',
            Label : 'Report Details',
            Target : '@UI.FieldGroup#ReportDetails'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'Expenses',
            Label : 'Expenses',
            Target : 'expenses/@UI.LineItem#ReportExpenses'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'FlightLegs',
            Label : 'Flight Legs',
            Target : 'legs/@UI.LineItem'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'Crew',
            Label : 'Crew',
            Target : 'crew/@UI.LineItem'
        }
    ]
);

// Defines the landing-page table and its inline bulk-approval action.
annotate audit.FlightReports with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Report', Value : reportNumber },
        { $Type : 'UI.DataField', Label : 'Aircraft', Value : aircraft_ID },
        { $Type : 'UI.DataField', Label : 'First Flight', Value : firstFlightDate },
        { $Type : 'UI.DataField', Label : 'Last Flight', Value : lastFlightDate },
        { $Type : 'UI.DataField', Label : 'Total Hours', Value : totalFlightHours },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus },
        {
            $Type : 'UI.DataFieldForAction',
            Label : 'Approve All Expenses',
            Action : 'AuditService.approveAllExpenses',
            Inline : true,
            Criticality : #Positive,
            ![@UI.Importance] : #High
        }
    ]
);

// =============================================================================
// Supporting tables
// These LineItems render compositions embedded in the report/expense pages.
// =============================================================================

// Read-only operational legs shown inside the Flight Report Object Page.
annotate audit.FlightLegs with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Leg', Value : sequence, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Date', Value : flightDate, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Origin', Value : originAirportCode, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Destination', Value : destinationAirportCode, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Flight Hours', Value : flightHours, ![@UI.Importance] : #High }
    ]
);

// Read-only crew assignments shown inside the Flight Report Object Page.
annotate audit.CrewAssignments with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Crew Member', Value : crewMember_ID, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Role', Value : role, ![@UI.Importance] : #High }
    ]
);

// Status changes and auditor comments shown on the Expense Object Page.
annotate audit.ExpenseAuditHistory with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'From', Value : fromStatus },
        { $Type : 'UI.DataField', Label : 'To', Value : toStatus },
        { $Type : 'UI.DataField', Label : 'Comment', Value : comment },
        { $Type : 'UI.DataField', Label : 'Changed At', Value : createdAt },
        { $Type : 'UI.DataField', Label : 'Changed By', Value : createdBy }
    ]
);

// =============================================================================
// Display semantics
// Common.Text replaces technical keys with meaningful business values wherever
// Fiori displays the association. ValueCriticality maps statuses to UI colors.
// =============================================================================

annotate audit.Expenses with {
    report @(
        title : 'Flight Report',
        Common.Text : report.reportNumber,
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
    expenseDate                @title : 'Expense Date';
    originalAmount             @title : 'Amount';
    supplier                   @title : 'Supplier';
    receiptNumber              @title : 'Receipt Number';
    description                @title : 'Description';
    correctionReason           @title : 'Correction Reason';
    addedAfterReportSubmission @title : 'Added After Submission';
    auditStatus @(
        title : 'Audit Status',
        UI.ValueCriticality : [
            { Value : 'PENDING', Criticality : #Information },
            { Value : 'NEEDS_CORRECTION', Criticality : #Negative },
            { Value : 'APPROVED', Criticality : #Positive }
        ]
    );
};

annotate audit.FlightReports with {
    pendingExpenseCount @UI.Hidden;
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
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'description'
                }
            ]
        }
    );
    reportNumber @(
        title : 'Report Number',
        Common.ValueList : {
            CollectionPath : 'FlightReports',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : reportNumber,
                    ValueListProperty : 'reportNumber'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'aircraft_ID'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'firstFlightDate'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'lastFlightDate'
                }
            ]
        }
    );
    requesterName @title : 'Flight Requester';
    firstFlightDate @title : 'First Flight Date';
    lastFlightDate  @title : 'Last Flight Date';
    auditStatus @(
        title : 'Audit Status',
        Common.ValueListWithFixedValues : true,
        Common.ValueList : {
            CollectionPath : 'ReportAuditStatuses',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : auditStatus,
                    ValueListProperty : 'code'
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name'
                }
            ]
        },
        UI.ValueCriticality : [
            { Value : 'PENDING', Criticality : #Information },
            { Value : 'ACTION_REQUIRED', Criticality : #Negative },
            { Value : 'APPROVED', Criticality : #Positive }
        ]
    );
};

// Keeps fixed status values in their intended business order.
annotate audit.ReportAuditStatuses with @(
    UI.PresentationVariant : {
        SortOrder : [{ Property : sortOrder, Descending : false }]
    }
);

annotate audit.FlightLegs with {
    // The technical UUID stays hidden while sequenceText represents the leg.
    ID @(
        UI.Hidden,
        Common.Text : sequenceText,
        Common.TextArrangement : #TextOnly
    );
};

annotate audit.CrewAssignments with {
    crewMember @(
        title : 'Crew Member',
        Common.Text : crewMember.fullName,
        Common.TextArrangement : #TextOnly
    );
    role @title : 'Role';
};

// =============================================================================
// Action behavior
// OperationAvailable controls button visibility. SideEffects tell Fiori which
// properties and child collections must be refreshed after an action finishes.
// =============================================================================

annotate audit.Expenses actions {
    // Only pending expenses expose the two mutually exclusive audit decisions.
    approveExpense @(
        Core.OperationAvailable : ($self.auditStatus = 'PENDING'),
        Common.SideEffects : {
            TargetProperties : [
                'in/auditStatus',
                'in/auditedAt',
                'in/auditedBy',
                'in/correctionReason'
            ],
            TargetEntities : [
                'in/report',
                '/AuditService.EntityContainer/FlightReports'
            ]
        }
    );
    requestExpenseCorrection @(
        Core.OperationAvailable : ($self.auditStatus = 'PENDING'),
        Common.SideEffects : {
            TargetProperties : [
                'in/auditStatus',
                'in/auditedAt',
                'in/auditedBy',
                'in/correctionReason'
            ],
            TargetEntities : [
                'in/report',
                '/AuditService.EntityContainer/FlightReports'
            ]
        }
    );
};

annotate audit.FlightReports actions {
    // IsActionCritical requests confirmation before the bulk action executes.
    approveAllExpenses @(
        Common.IsActionCritical : true,
        Core.OperationAvailable : (
            $self.pendingExpenseCount > 0
        ),
        Common.SideEffects : {
            TargetProperties : [
                'in/auditStatus',
                'in/pendingExpenseCount'
            ],
            TargetEntities : [
                'in/expenses',
                '/AuditService.EntityContainer/FlightReports'
            ]
        }
    );
};
