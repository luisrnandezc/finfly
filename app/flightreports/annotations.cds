using ExpenseService as service from '../../srv/expense-service';
annotate service.FlightReports with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'reportNumber',
                Value : reportNumber,
            },
            {
                $Type : 'UI.DataField',
                Label : 'requesterName',
                Value : requesterName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'notes',
                Value : notes,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'reportNumber',
            Value : reportNumber,
        },
        {
            $Type : 'UI.DataField',
            Label : 'requesterName',
            Value : requesterName,
        },
        {
            $Type : 'UI.DataField',
            Label : 'status',
            Value : status,
        },
        {
            $Type : 'UI.DataField',
            Label : 'notes',
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

