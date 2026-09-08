using AuditService as audit from '../../srv/audit-service';

annotate audit.Expenses with @(
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Expense',
        TypeNamePlural : 'Expenses',
        Title : { $Type : 'UI.DataField', Value : category.name },
        Description : { $Type : 'UI.DataField', Value : report.reportNumber }
    },
    UI.SelectionFields : [
        auditStatus,
        report_ID,
        expenseDate,
        category_ID,
        originalCurrency_code,
        addedAfterReportSubmission
    ],
    UI.PresentationVariant #AuditQueue : {
        SortOrder : [{ Property : submittedForAuditAt, Descending : true }]
    },
    UI.SelectionVariant #PendingExpenses : {
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

annotate audit.FlightReports with @(
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Flight Report',
        TypeNamePlural : 'Flight Reports',
        Title : { $Type : 'UI.DataField', Value : reportNumber },
        Description : { $Type : 'UI.DataField', Value : requesterName }
    },
    UI.Identification : [{
        $Type : 'UI.DataFieldForAction',
        Label : 'Approve All Expenses',
        Action : 'AuditService.approveAllExpenses',
        Criticality : #Positive
    }],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Report', Value : reportNumber },
        { $Type : 'UI.DataField', Label : 'Aircraft', Value : aircraft_ID },
        { $Type : 'UI.DataField', Label : 'First Flight', Value : firstFlightDate },
        { $Type : 'UI.DataField', Label : 'Last Flight', Value : lastFlightDate },
        { $Type : 'UI.DataField', Label : 'Total Hours', Value : totalFlightHours },
        { $Type : 'UI.DataField', Label : 'Audit Status', Value : auditStatus }
    ]
);

annotate audit.ExpenseAuditHistory with @(
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'From', Value : fromStatus },
        { $Type : 'UI.DataField', Label : 'To', Value : toStatus },
        { $Type : 'UI.DataField', Label : 'Comment', Value : comment },
        { $Type : 'UI.DataField', Label : 'Changed At', Value : createdAt },
        { $Type : 'UI.DataField', Label : 'Changed By', Value : createdBy }
    ]
);

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
    aircraft @(
        title : 'Aircraft',
        Common.Text : aircraft.registration,
        Common.TextArrangement : #TextOnly
    );
    auditStatus @(
        title : 'Audit Status',
        UI.ValueCriticality : [
            { Value : 'PENDING', Criticality : #Information },
            { Value : 'ACTION_REQUIRED', Criticality : #Negative },
            { Value : 'APPROVED', Criticality : #Positive }
        ]
    );
};

annotate audit.FlightLegs with {
    ID @(
        UI.Hidden,
        Common.Text : sequenceText,
        Common.TextArrangement : #TextOnly
    );
};

annotate audit.Expenses actions {
    approveExpense @(
        Core.OperationAvailable : ($self.auditStatus = 'PENDING'),
        Common.SideEffects : {
            TargetProperties : [
                'in/auditStatus',
                'in/auditedAt',
                'in/auditedBy',
                'in/correctionReason'
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
            ]
        }
    );
};

annotate audit.FlightReports actions {
    approveAllExpenses @(
        Core.OperationAvailable : (
            $self.auditStatus = 'PENDING' or
            $self.auditStatus = 'ACTION_REQUIRED'
        ),
        Common.SideEffects : {
            TargetProperties : ['in/auditStatus'],
            TargetEntities : ['in/expenses']
        }
    );
};
