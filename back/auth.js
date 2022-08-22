const {Session, serviceClients} = require('@yandex-cloud/nodejs-sdk')
const {GetPayloadRequest} = require("@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/payload_service")
const {createHash, createHmac} = require('crypto');
const jwt = require('jsonwebtoken');
const {Driver, getCredentialsFromEnv} = require('ydb-sdk')

function generateDataString({hash, source, ...data}) {
    // Stolen from https://gist.github.com/Pitasi/574cb19348141d7bf8de83a0555fd2dc
    return Object
        .keys(data)
        .sort()
        .map(k => (`${k}=${data[k]}`))
        .join('\n')
}

function getPayloadByKey(payloadResp, key) {
    let entries = payloadResp.entries.filter(k => k.key === key)
    if (entries.length > 0) {
        console.log(entries)
        return entries[0]
    } else {
        return null
    }
}


module.exports.handler = async function (request, context) {
    if (request.queryStringParameters.source === undefined) {
        return {
            statusCode: 422, body: "Incorrect request"
        }
    }

    let cloudSession = new Session({})
    let lockboxClient = cloudSession.client(serviceClients.PayloadServiceClient)
    let data = await lockboxClient.get(GetPayloadRequest.fromPartial({
        secretId: process.env.SECRET_ID
    }))
    let secretKey = getPayloadByKey(data, 'JWT_KEY').textValue
    let botToken = getPayloadByKey(data, 'BOT_TOKEN').textValue
    let endpoint = getPayloadByKey(data, 'YDB_ENDPOINT').textValue
    let database = getPayloadByKey(data, 'YDB_DATABASE').textValue
    let afterLoginRedirect = getPayloadByKey(data, 'AFTER_LOGIN_REDIRECT').textValue
    let driverAuthService = getCredentialsFromEnv()
    let driver = new Driver({
        endpoint: endpoint, database: database, authService: driverAuthService
    })
    let response = {}
    await driver.tableClient.withSession(async (session) => {
        if (request.queryStringParameters.source === "telegram") {
            let dataString = generateDataString(request.queryStringParameters)
            const secret = createHash('sha256')
                .update(botToken)
                .digest()
            const hmac = createHmac('sha256', secret)
                .update(dataString)
                .digest('hex')
            if (hmac === request.queryStringParameters.hash) {
                let userId = request.queryStringParameters.id
                let userName = request.queryStringParameters.first_name ?? "" + request.queryStringParameters.last_name ?? ""
                let token = jwt.sign({userId: userId, userName: userName}, secretKey)
                response = {
                    statusCode: 301, body: JSON.stringify({
                        ok: true, data: {token}
                    }), headers: {
                        "Set-Cookie": `token=${token}`,
                        "Location": afterLoginRedirect
                    }
                }
            } else {
                response = {
                    statusCode: 403, body: JSON.stringify({
                        ok: false, data: "signature verification failed"
                    })
                }
            }
        }
    })
    if (response !== {}) {
        return response
    }
    return {
        statusCode: 500, body: "Error occurred",
    }

}