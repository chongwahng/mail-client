using AdminService as service from '../../srv/MailService';

annotate service.Mail with {
    ID          @UI.Hidden;
    subject     @title : 'Email Subject';
    fromSender  @title : 'Sender Email Address';
    toRecipient @title : 'Recipient Email Address';
    body        @title : 'Body Text'
                @UI.MultiLineText;
    status      @readonly
                @title : 'Sent Status';
    message     @readonly
                @title : 'Status Message';
    destination @readonly
                @title : 'Mail System Destination';
};

annotate service.Mail_Attachments with {
    ID           @UI.Hidden;
    contentBytes @UI.Hidden;
    contentType  @title : 'File Type';
    name         @title : 'File Name';
};

annotate service.Mail with @(UI.LineItem : [
    {
        $Type                     : 'UI.DataField',
        Value                     : status,
        Criticality               : statusCriticality,
        CriticalityRepresentation : #WithIcon,
        ![@UI.Importance]         : #High
    },
    {
        $Type              : 'UI.DataFieldForAction',
        Label              : 'Re-Send',
        Action             : 'AdminService.send',
        InvocationGrouping : #Isolated,
        Inline             : true,
        ![@UI.Hidden]      : sendHidden,
        ![@UI.Importance]  : #High
    },
    {
        $Type : 'UI.DataField',
        Value : message
    },    
    {
        $Type : 'UI.DataField',
        Value : subject
    },
    {
        $Type : 'UI.DataField',
        Value : toRecipient
    },
    {
        $Type : 'UI.DataField',
        Value : fromSender
    },
    {
        $Type : 'UI.DataField',
        Value : body
    },
    {
        $Type : 'UI.DataField',
        Value : destination
    }
]);

annotate service.Mail_Attachments with @(UI.LineItem : [
    {
        $Type : 'UI.DataField',
        Value : name
    },
    {
        $Type : 'UI.DataField',
        Value : contentType
    },
    {
        $Type : 'UI.DataField',
        Value : createdAt
    }
]);

annotate service.Mail with @(
    UI.HeaderInfo                  : {
        TypeName       : 'Mail',
        TypeNamePlural : 'Mails',
        Title          : {Value : subject},
        ImageUrl       : 'sap-icon://email',
    },
    UI.FieldGroup #GeneratedGroup1 : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Value : subject,
            },
            {
                $Type : 'UI.DataField',
                Value : toRecipient,
            },
            {
                $Type : 'UI.DataField',
                Value : fromSender,
            },
            {
                $Type : 'UI.DataField',
                Value : body,
            },
            {
                $Type                     : 'UI.DataField',
                Value                     : status,
                Criticality               : statusCriticality,
                CriticalityRepresentation : #WithIcon,
            },
            {
                $Type : 'UI.DataField',
                Value : message
            },
            {
                $Type : 'UI.DataField',
                Value : destination,
            }
        ],
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
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Email Attachment',
            Target : 'Attachments/@UI.LineItem'
        }
    ]
);

annotate service.Mail_Attachments with @(UI.HeaderInfo : {
    TypeName       : 'Attachment',
    TypeNamePlural : 'Attachments'
});
