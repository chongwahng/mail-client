using AdminService as service from '../../srv/MailService';

annotate service.Whitelist with {
    ID          @UI.Hidden;
    addressArea @title : 'Address Area';
};

annotate service.Whitelist with @(UI.LineItem : [{
    $Type : 'UI.DataField',
    Value : addressArea,
}, ]);

annotate service.Whitelist with @(
    UI.HeaderInfo                  : {
        TypeName       : 'Address Area',
        TypeNamePlural : 'Address Areas',
        ImageUrl       : 'sap-icon://customer-and-contacts',
    },    
    UI.FieldGroup #GeneratedGroup1 : {
        $Type : 'UI.FieldGroupType',
        Data  : [{
            $Type : 'UI.DataField',
            Value : addressArea,
        }, ],
    },
    UI.FieldGroup #Admin           : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {Value : createdBy},
            {Value : createdAt},
            {Value : modifiedBy},
            {Value : modifiedAt}
        ]
    },
    UI.Facets                      : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GeneratedFacet1',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup1',
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Admin Information',
            Target : '@UI.FieldGroup#Admin'
        }
    ]
);
