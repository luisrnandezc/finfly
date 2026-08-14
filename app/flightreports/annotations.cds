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
        status
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
                Label : 'Requester Name',
                Value : requesterName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Status',
                Value : status,
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
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
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
            Label : 'Requester Name',
            Value : requesterName,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Status',
            Value : status,
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

