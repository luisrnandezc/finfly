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

annotate staff.Organizations with @(
    Capabilities.InsertRestrictions : { Insertable : false },
    Capabilities.DeleteRestrictions : { Deletable : false },
    UI.SelectionFields : [name, code, active],
    UI.LineItem : [
        { $Type : 'UI.DataField', Label : 'Name', Value : name, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Code', Value : code, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Active Users', Value : activeUserCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Pilots', Value : activePilotCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Auditors', Value : activeAuditorCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Administrators', Value : activeAdministratorCount, ![@UI.Importance] : #High },
        { $Type : 'UI.DataField', Label : 'Active', Value : active, ![@UI.Importance] : #High },
        { $Type : 'UI.DataFieldForAction', Label : 'Add Administrator', Action : 'StaffService.addAdministrator' },
        { $Type : 'UI.DataFieldForAction', Label : 'Deactivate', Action : 'StaffService.deactivateOrganization', Criticality : #Negative },
        { $Type : 'UI.DataFieldForAction', Label : 'Reactivate', Action : 'StaffService.reactivateOrganization', Criticality : #Positive }
    ]
);

annotate staff.Organizations with {
    ID @UI.Hidden;
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
    deactivateAdministrator @Core.OperationAvailable : ($self.active = true);
    reactivateAdministrator @Core.OperationAvailable : ($self.active = false);
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

