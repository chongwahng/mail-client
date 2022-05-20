using {
    cuid,
    managed
} from '@sap/cds/common';

namespace db;

entity Mails : cuid, managed {
    fromSender  : String;
    toRecipient : String;
    subject     : String;
    body        : String;
    status      : String(10);
    message     : String;
    destination : String(40);
    Attachments : Composition of many Mail_Attachments
                      on Attachments.parent = $self;
}

entity Whitelists : cuid, managed {
    addressArea : String;
}

entity Mail_Attachments : cuid, managed {
    key parent       : Association to Mails;
        name         : String(200);
        contentType  : String(30);
        contentBytes : String; // content bytes encoded in Base64
}
