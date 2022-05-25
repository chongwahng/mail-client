using db from '../db/data-model';

service AdminService @(
    requires : 'EmailServiceAdmin',
    path     : '/admin'
) {

    @Capabilities.InsertRestrictions.Insertable : false
    @Capabilities.UpdateRestrictions.Updatable  : false
    @Capabilities.DeleteRestrictions.Deletable  : true
    entity Mail      as projection on db.Mails actions {
        action send();
    }

    entity Whitelist as projection on db.Whitelists;
}

annotate AdminService.Whitelist with @odata.draft.enabled;

service APIService @(
    requires : 'system-user',
    path     : '/mail-api'
) {

    @insertonly
    entity Mail as projection on db.Mails;

    action house_keep();
}
