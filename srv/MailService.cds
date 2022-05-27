using db from '../db/data-model';

service AdminService @(
    requires : 'EmailServiceAdmin',
    path     : '/admin'
) {

    @Capabilities.InsertRestrictions.Insertable : false
    @Capabilities.UpdateRestrictions.Updatable  : false
    @Capabilities.DeleteRestrictions.Deletable  : true
    entity Mail      as projection on db.Mails actions {
        @(Common.IsActionCritical : true)
        action send();
    }

    entity Whitelist as projection on db.Whitelists;
}

annotate AdminService.Whitelist with @odata.draft.enabled;

service APIService @(
    requires : 'system-user',
    path     : '/api'
) {

    @insertonly
    entity Mail as projection on db.Mails;

    action house_keep();
    action send_to_many_recipients(email : db.ManyRecipients)
}
