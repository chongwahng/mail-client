const { retrieveJwt, decodeJwtComplete } = require('@sap-cloud-sdk/core');

module.exports = async function (srv) {
    const cds = require('@sap/cds');

    console.log(`Service name: ${srv.name} is served at ${srv.path}`);

    srv.on("send", async (req) => {
        console.log(`Entity action "${req.event}" invoked`);
        console.log(`ID = ${req.params[0]}`);

        const { Mails } = cds.entities;
        let query = SELECT.one.from(Mails, req.params[0]);
        let result = await cds.run(query);

        if (result != undefined) {
            const recipient = result.toRecipient;

            if (result.status === 'ERROR') {
                const whitelists = await getWhitelists();
                const isAllowed = await checkRecipientEmailAddress(whitelists, recipient);

                if (isAllowed) {
                    let attachments = await getAttachments(req.params[0]);
                    if (attachments) Object.assign(result, { Attachments: attachments });

                    await sendEmail(result)
                        .then(async () => {
                            console.log(req.params[0])
                            query = UPDATE(Mails).set({ status: 'SUCCESS', message: `Email sent to ${recipient}` }).where({ ID: req.params[0] });
                            result = await cds.run(query);
                            console.log('HTTP POST Success');
                            req.info(`Email sent successfully!`);
                        })
                        .catch((error) => {
                            console.log('HTTP POST Error');
                            console.log(error.stack);
                            console.log(error.req._header);
                            console.log(error.response.data.error.message);
                            req.error(error.response.status, `Unable to send email.  ${error.response.data.error.message}`);
                        });
                } else {
                    query = UPDATE(Mails).set({ message: 'Recipient address not white-listed' }).where({ ID: req.params[0] });
                    result = await cds.run(query);
                    req.info(`Recipient address ${recipient} not white-listed`);
                }
            } else {
                req.info("No action required.  Email status is SUCCESS.");
            }
        } else {
            req.error('400', "Unable to send email");
        }
    });

    srv.before("CREATE", "Mail", async (req) => {
        if (req.data.destination === undefined) {
            Object.assign(req.data, { destination: process.env.GRAPH_API_DESTNAME });
        } else {
            req.data.destination = process.env.GRAPH_API_DESTNAME;
        }

        const whitelists = await getWhitelists();
        const isAllowed = await checkRecipientEmailAddress(whitelists, req.data.toRecipient);

        if (!isAllowed) {
            req.data.message = 'Recipient address not white-listed';
            req.data.status = 'ERROR';
        }
        else {
            await sendEmail(req.data)
                .then((resp) => {
                    console.log('HTTP POST Success');
                    req.data.message = `Email sent to ${req.data.toRecipient}`;
                    req.data.status = 'SUCCESS';
                })
                .catch((error) => {
                    console.log('HTTP POST Error');
                    console.log(error.stack);
                    //console.log(error.req._header);
                    console.log(error.response.data.error.message);
                    req.data.message = error.response.data.error.message;
                    req.data.status = 'ERROR';
                });
        }
    })

    srv.before("READ", "Mail", async (req) => {
        console.log("[BEFORE READ]");
        console.log('User data -> ' + JSON.stringify(req.user));
        console.log("User ID -> " + req.user.id);
        console.log("User attr -> " + JSON.stringify(req.user.attr));
        console.log("Is user authenticated? " + req.user.is('authenticated-user'));
        console.log("Is system-user? " + req.user.is('system-user'));
        console.log("Is internal-user? " + req.user.is('internal-user'));

        const jwt = retrieveJwt(req);
        if (jwt) {
            const decodedJWT = decodeJwtComplete(jwt);
            console.log(decodedJWT.payload.family_name + ' ' + decodedJWT.payload.given_name)
            console.log('user_name -> ' + decodedJWT.payload.user_name);
            console.log('email -> ' + decodedJWT.payload.email);
        }
    })

    srv.after("READ", "Mail", (result, context) => {
        console.log("[AFTER READ]");
    })
}

const cdsapi = require('@sapmentors/cds-scp-api');

async function sendEmail(entry) {
    const payload = {
        message: {
            subject: entry.subject,
            body: {
                contentType: "Text",
                content: entry.body
            },
            toRecipients: [
                {
                    emailAddress: {
                        address: entry.toRecipient
                    }
                }
            ],
            from: {
                emailAddress: {
                    address: entry.fromSender
                }
            }
        },
        saveToSentItems: "false"
    }

    // Construct list of attachment objects
    if (entry.Attachments) {
        var fileObj = [];
        const entries = entry.Attachments.entries();

        for (let i of entries) {
            fileObj.push({
                '@odata.type': "#microsoft.graph.fileAttachment",
                name: i[1].name,
                contentType: i[1].contentType,
                contentBytes: i[1].contentBytes
            });
        }
        Object.assign(payload.message, { attachments: fileObj });
    }

    console.log(payload);
    console.log("destination -> " + entry.destination);

    const service = await cdsapi.connect.to(entry.destination);

    console.log("mail service connected successfully, ready to send...");

    return await service.run({
        url: `/v1.0/users/${entry.fromSender}/sendMail`,
        method: "post",
        headers: {
            'content-type': 'application/json'
        },
        data: payload
    })
}

async function getWhitelists() {
    const { Whitelists } = cds.entities;
    const query = SELECT.from(Whitelists);
    return await cds.run(query);
}

async function getAttachments(parentID) {
    const { Mail_Attachments } = cds.entities;
    let query = SELECT.from(Mail_Attachments).where({ parent_ID: parentID });
    let result = await cds.run(query);

    if (result) {
        var attachments = [];

        if (!Array.isArray(result)) {
            attachments.push(result);
        }
        else attachments = result;

        return attachments;
    } else return null;
}

const wcmatch = require('wildcard-match');

async function checkRecipientEmailAddress(whitelists, recipient) {
    if (whitelists != undefined) {
        const entries = whitelists.entries();
        for (let i of entries) {
            console.log(i[1].addressArea);
            var isMatch = wcmatch(i[1].addressArea);
            if (isMatch(recipient)) return true;
        }
    }

    return false;
}