using StaffService as staff from '../../srv/staff-service';

annotate staff.Organizations with @(UI.SelectionPresentationVariant #AllOrganizations : {
    Text : 'Organizations',
    SelectionVariant : { Text : 'Organizations' },
    PresentationVariant : { SortOrder : [{ Property : name }] }
});

annotate staff.Administrators with @(UI.SelectionPresentationVariant #AllAdministrators : {
    Text : 'Administrators',
    SelectionVariant : { Text : 'Administrators' },
    PresentationVariant : { SortOrder : [{ Property : fullName }] }
});

annotate staff.Users with @(UI.SelectionPresentationVariant #AllUsers : {
    Text : 'Users',
    SelectionVariant : { Text : 'Users' },
    PresentationVariant : { SortOrder : [{ Property : fullName }] }
});

annotate staff.Organizations with @(
    Capabilities.InsertRestrictions : { Insertable : false },
    Capabilities.DeleteRestrictions : { Deletable : false },
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'Organization',
        TypeNamePlural : 'Organizations',
        Title : { $Type : 'UI.DataField', Value : name },
        Description : { $Type : 'UI.DataField', Value : code }
    },
    UI.SelectionFields : [name, code, active],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Name', Value : name, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Code', Value : code, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Active Users', Value : activeUserCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Pilots', Value : activePilotCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Auditors', Value : activeAuditorCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Administrators', Value : activeAdministratorCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Active', Value : active, ![@UI.Importance] : #High },
        { $Type : 'UI.DataFieldForAction', Label : 'Deactivate', Action : 'StaffService.deactivateOrganization', Criticality : #Negative },
        { $Type : 'UI.DataFieldForAction', Label : 'Reactivate', Action : 'StaffService.reactivateOrganization', Criticality : #Positive }
    ],
    UI.FieldGroup #OrganizationDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Name', Value : name },
            { $Type : 'UI.DataField', Label : 'Code', Value : code },
            { $Type : 'UI.DataField', Label : 'Active', Value : active }
        ]
    },
    UI.FieldGroup #UserSummary : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'Active Users', Value : activeUserCount },
            { $Type : 'UI.DataField', Label : 'Pilots', Value : activePilotCount },
            { $Type : 'UI.DataField', Label : 'Auditors', Value : activeAuditorCount },
            { $Type : 'UI.DataField', Label : 'Administrators', Value : activeAdministratorCount }
        ]
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'OrganizationDetails',
            Label : 'Organization Details',
            Target : '@UI.FieldGroup#OrganizationDetails'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'UserSummary',
            Label : 'Active User Summary',
            Target : '@UI.FieldGroup#UserSummary'
        }
    ]
);

annotate staff.Organizations with {
    ID @UI.Hidden;
};

annotate staff.Users with @(
    Capabilities.InsertRestrictions : { Insertable : false },
    Capabilities.DeleteRestrictions : { Deletable : false },
    UI.HeaderInfo : {
        $Type : 'UI.HeaderInfoType',
        TypeName : 'User',
        TypeNamePlural : 'Users',
        Title : { $Type : 'UI.DataField', Value : fullName },
        Description : { $Type : 'UI.DataField', Value : organizationName }
    },
    UI.SelectionFields : [fullName, userId, organizationName, isPilot, isAuditor, isAdmin, active],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Full Name', Value : fullName, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'User ID', Value : userId, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Organization', Value : organizationName, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Pilot', Value : isPilot, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Auditor', Value : isAuditor, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Administrator', Value : isAdmin, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Active', Value : active, ![@UI.Importance] : #High }
    ],
    UI.FieldGroup #PersonalDetails : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type : 'UI.DataField', Label : 'National ID', Value : nationalId },
            { $Type : 'UI.DataField', Label : 'First Name', Value : firstName },
            { $Type : 'UI.DataField', Label : 'Last Name', Value : lastName },
            { $Type : 'UI.DataField', Label : 'User ID', Value : userId },
            { $Type : 'UI.DataField', Label : 'Organization', Value : organizationName },
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
            { $Type : 'UI.DataField', Label : 'License Type', Value : licenseType },
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

annotate staff.Users with {
    ID @UI.Hidden;
    organization_ID @UI.Hidden;
    organization @UI.Hidden;
    organizationName @title : 'Organization';
    nationalId @title : 'National ID';
    firstName @title : 'First Name';
    lastName @title : 'Last Name';
    fullName @title : 'Full Name';
    userId @title : 'User ID';
    isPilot @title : 'Pilot';
    isAuditor @title : 'Auditor';
    isAdmin @title : 'Administrator';
    positionTitle @title : 'Position';
    licenseType @title : 'License Type';
    totalFlightHours @title : 'Total Flight Hours';
    active @title : 'Active';
};

annotate staff.Administrators with @(
    Capabilities.InsertRestrictions : { Insertable : false },
    Capabilities.DeleteRestrictions : { Deletable : false },
    UI.SelectionFields : [fullName, userId, organizationName, active],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Full Name', Value : fullName, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'User ID', Value : userId, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Organization', Value : organizationName, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Active', Value : active, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Created', Value : createdAt, ![@UI.Importance] : #Medium },
        { $Type : 'UI.DataFieldForAction', Label : 'Set Temporary Password', Action : 'StaffService.setTemporaryPassword' },
        { $Type : 'UI.DataFieldForAction', Label : 'Deactivate', Action : 'StaffService.deactivateAdministrator', Criticality : #Negative },
        { $Type : 'UI.DataFieldForAction', Label : 'Reactivate', Action : 'StaffService.reactivateAdministrator', Criticality : #Positive }
    ]
);

annotate staff.Administrators with {
    ID @UI.Hidden;
    organization_ID @UI.Hidden;
    organization @UI.Hidden;
    organizationName @title : 'Organization';
};

annotate staff.Organizations actions {
    deactivateOrganization @Core.OperationAvailable : ($self.active = true and $self.code != 'FINFLY');
    reactivateOrganization @Core.OperationAvailable : ($self.active = false and $self.code != 'FINFLY');
    addAdministrator @Core.OperationAvailable : ($self.active = true and $self.code != 'FINFLY');
};

annotate staff.Administrators actions {
    deactivateAdministrator @(
        Core.OperationAvailable : ($self.active = true),
        Common.SideEffects : { TargetEntities : [organization] }
    );
    reactivateAdministrator @(
        Core.OperationAvailable : ($self.active = false),
        Common.SideEffects : { TargetEntities : [organization] }
    );
    setTemporaryPassword @Core.OperationAvailable : ($self.active = true);
};

annotate staff.createOrganization with {
    code @title : 'Organization Code';
    name @title : 'Organization Name';
    administratorUserId @title : 'Administrator User ID';
    temporaryPassword @title : 'Temporary Password';
    nationalId @title : 'Administrator National ID';
    firstName @title : 'Administrator First Name';
    lastName @title : 'Administrator Last Name';
};

