const { retrieveJwt, decodeJwtComplete } = require('@sap-cloud-sdk/core')

module.exports = async function (srv) {
    const cds = require('@sap/cds')

    console.log(`Service name: ${srv.name} is served at ${srv.path}`)

    srv.on('send', async (req) => {
        console.log(`Entity action "${req.event}" invoked`)
        console.log(`ID = ${req.params[0]}`)

        const { Mails } = cds.entities
        let query = SELECT.one.from(Mails, req.params[0])
        let result = await cds.run(query)

        if (result != undefined) {
            const recipient = result.toRecipient

            if (result.status === 'ERROR') {
                const whitelists = await getWhitelists()
                const isAllowed = await checkRecipientEmailAddress(whitelists, recipient)

                if (isAllowed) {
                    let attachments = await getAttachments(req.params[0])
                    if (attachments) Object.assign(result, { Attachments: attachments })

                    await sendEmail(result)
                        .then(async () => {
                            console.log(req.params[0])
                            query = UPDATE(Mails).set({ status: 'SUCCESS', message: `Email sent to ${recipient}` }).where({ ID: req.params[0] })
                            result = await cds.run(query)
                            console.log('HTTP POST Success')
                            req.info(`Email sent successfully!`)
                        })
                        .catch((error) => {
                            console.log('HTTP POST Error')
                            console.log(error.stack)
                            console.log(error.req._header)
                            console.log(error.response.data.error.message)
                            req.error(error.response.status, `Unable to send email.  ${error.response.data.error.message}`)
                        })
                } else {
                    query = UPDATE(Mails).set({ message: 'Recipient address not white-listed' }).where({ ID: req.params[0] })
                    result = await cds.run(query)
                    req.info(`Recipient address ${recipient} not white-listed`)
                }
            } else {
                req.info('No action required.  Email status is SUCCESS.')
            }
        } else {
            req.error('400', 'Unable to send email')
        }
    })

    srv.on('house_keep', async (req) => {
        console.log('house keeping run invoked successfully')

        if (process.env.EMAIL_TASK_AGING_THRESHHOLD) {
            aging = process.env.EMAIL_TASK_AGING_THRESHHOLD
        }
        else {
            aging = 30  // default value, in case user variable not maintained
        }

        var today = new Date()
        var ageDate = new Date()
        ageDate.setDate(today.getDate() - aging)
        console.log(`Aging date -> ${ageDate}`)

        const { Mails, Mail_Attachments } = cds.entities

        var query = SELECT.from(Mails) // get all email task entries
        var result = await cds.run(query)

        const entries = result.entries()

        for (let i of entries) {
            var createdAt = new Date(i[1].createdAt)

            if (createdAt.valueOf() < ageDate.valueOf()) {
                query = DELETE.from(Mail_Attachments).where({ parent_ID: i[1].ID })    // remove all child entries => attachments
                await cds.run(query)

                query = DELETE.from(Mails).where({ ID: i[1].ID })  // remove parent entry => email task
                await cds.run(query)
            }
        }
    })

    srv.on('send_to_many_recipients', async (req) => {
        console.log('action send_to_recipients invoked successfully')

        const { Mails, Mail_Attachments } = cds.entities

        let emails = []

        for (let recipientEntry of req.data.email.toRecipients.entries()) {
            let email = {
                fromSender: req.data.email.fromSender,
                toRecipient: recipientEntry[1].address,
                subject: req.data.email.subject,
                body: req.data.email.body,
                destination: process.env.GRAPH_API_DESTNAME
            }

            // Create email header entry first
            let query = INSERT.into(Mails).entries(email)
            let result = await cds.run(query)

            // Start constructing created entry of email
            let index = emails.push(result.req.data) - 1
            Object.assign(emails[index], { Attachments: [] })

            // Now create child entries - file attachments
            for (let attachmentEntry of req.data.email.attachments.entries()) {
                let attachment = {
                    parent_ID: result.req.data.ID,
                    name: attachmentEntry[1].name,
                    contentType: attachmentEntry[1].contentType,
                    contentBytes: attachmentEntry[1].contentBytes
                }
                query = INSERT.into(Mail_Attachments).entries(attachment)
                await cds.run(query)

                emails[index].Attachments.push(attachment)
            }
        }

        const whitelists = await getWhitelists()

        // Entries created successfully, attempt to send out the email entries
        for (let emailEntry of emails.entries()) {
            const isAllowed = await checkRecipientEmailAddress(whitelists, emailEntry[1].toRecipient)

            if (isAllowed) {
                await sendEmail(emailEntry[1])
                    .then(async () => {
                        query = UPDATE(Mails).set({ status: 'SUCCESS', message: `Email sent to ${emailEntry[1].toRecipient}` }).where({ ID: emailEntry[1].ID })
                        await cds.run(query)
                        console.log('HTTP POST Success')
                        console.log(`Email sent successfully!`)
                    })
                    .catch(async (error) => {
                        query = UPDATE(Mails).set({ status: 'ERROR', message: `Unable to send email` }).where({ ID: emailEntry[1].ID })
                        await cds.run(query)
                        console.log('HTTP POST Error')
                        console.log(error.stack)
                        console.log(error.req._header)
                        console.log(error.response.data.error.message)
                    })
            } else {
                query = UPDATE(Mails).set({ status: 'ERROR', message: 'Recipient address not white-listed' }).where({ ID: emailEntry[1].ID })
                await cds.run(query)
            }
        }
    })

    srv.before('CREATE', 'Mail', async (req) => {
        if (req.data.destination === undefined) {
            Object.assign(req.data, { destination: process.env.GRAPH_API_DESTNAME })
        } else {
            req.data.destination = process.env.GRAPH_API_DESTNAME
        }

        const whitelists = await getWhitelists()
        const isAllowed = await checkRecipientEmailAddress(whitelists, req.data.toRecipient)

        if (!isAllowed) {
            req.data.message = 'Recipient address not white-listed'
            req.data.status = 'ERROR'
        }
        else {
            await sendEmail(req.data)
                .then((resp) => {
                    console.log('HTTP POST Success')
                    req.data.message = `Email sent to ${req.data.toRecipient}`
                    req.data.status = 'SUCCESS'
                })
                .catch((error) => {
                    console.log('HTTP POST Error')
                    console.log(error.stack)
                    console.log(error.response.data.error.message)
                    req.data.message = error.response.data.error.message
                    req.data.status = 'ERROR'
                })
        }
    })

    srv.before('READ', 'Mail', async (req) => {
        console.log("[BEFORE READ]")
        console.log(`User data -> ${JSON.stringify(req.user)}`)
        console.log(`User ID -> ${req.user.id}`)
        console.log(`User attr -> ${JSON.stringify(req.user.attr)}`)
        console.log(`Is user authenticated? ${req.user.is('authenticated-user')}`)
        console.log(`Is system-user? ${req.user.is('system-user')}`)
        console.log(`Is internal-user? ${req.user.is('internal-user')}`)

        const jwt = retrieveJwt(req)
        if (jwt) {
            const decodedJWT = decodeJwtComplete(jwt)
            console.log(decodedJWT.payload.family_name + ' ' + decodedJWT.payload.given_name)
            console.log(`user_name -> ${decodedJWT.payload.user_name}`)
            console.log(`email -> ${decodedJWT.payload.email}`)
        }
    })

    srv.after('READ', 'Mail', (result, context) => {
        console.log('[AFTER READ]')

        if (Array.isArray(result)) {
            for (let i of result.entries()) {
                setMailEntityFieldControl(i[1])
            }
        } else {
            setMailEntityFieldControl(result)
        }
        console.log(result)
    })
}

function setMailEntityFieldControl(entity) {
    switch (entity.status) {
        case 'SUCCESS':
            entity.sendHidden = true
            entity.statusCriticality = 3
            break
        case 'ERROR':
            entity.sendHidden = false
            entity.statusCriticality = 1
            break
    }
}

const cdsapi = require('@sapmentors/cds-scp-api')

async function sendEmail(entry) {
    const payload = {
        message: {
            subject: entry.subject,
            body: {
                contentType: 'Text',
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
        saveToSentItems: 'false'
    }

    // Construct list of attachment objects
    if (entry.Attachments) {
        var fileObj = []
        const entries = entry.Attachments.entries()

        for (let i of entries) {
            fileObj.push({
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: i[1].name,
                contentType: i[1].contentType,
                contentBytes: i[1].contentBytes
            })
        }
        Object.assign(payload.message, { attachments: fileObj })
    }

    console.log(payload)
    console.log(`destination -> ${entry.destination}`)

    const service = await cdsapi.connect.to(entry.destination)

    console.log('mail service connected successfully, ready to send...')

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
    const { Whitelists } = cds.entities
    const query = SELECT.from(Whitelists)
    return await cds.run(query)
}

async function getAttachments(parentID) {
    const { Mail_Attachments } = cds.entities
    let query = SELECT.from(Mail_Attachments).where({ parent_ID: parentID })
    let result = await cds.run(query)

    if (result) {
        var attachments = []

        if (!Array.isArray(result)) {
            attachments.push(result)
        }
        else attachments = result

        return attachments
    } else return null
}

const wcmatch = require('wildcard-match')

async function checkRecipientEmailAddress(whitelists, recipient) {
    if (whitelists != undefined) {
        const entries = whitelists.entries()
        for (let i of entries) {
            console.log(i[1].addressArea)
            var isMatch = wcmatch(i[1].addressArea)
            if (isMatch(recipient)) return true
        }
    }

    return false
}