const {Session, serviceClients} = require('@yandex-cloud/nodejs-sdk')
const {GetPayloadRequest} = require("@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/payload_service")
const jwt = require('jsonwebtoken');

function getPayloadByKey(payloadResp, key) {
    let entries = payloadResp.entries.filter(k => k.key === key)
    if (entries.length > 0) {
        console.log(entries)
        return entries[0]
    } else {
        return null
    }
}

module.exports.handler = async function(request, context) {
    let cloudSession = new Session({})
    let lockboxClient = cloudSession.client(serviceClients.PayloadServiceClient)
    let data = await lockboxClient.get(GetPayloadRequest.fromPartial({
        secretId: process.env.SECRET_ID
    }))
    let secret = getPayloadByKey(data, 'JWT_KEY').textValue
    let tokenHeader = request.headers.Authorization
    if (tokenHeader !== undefined) {
        tokenHeader = tokenHeader.replace("Bearer ", "")
        console.log(tokenHeader)
    } else {
        return {
            "isAuthorized": false,
            "context": {}
        }
    }
    try {
        let decoded = jwt.verify(tokenHeader, secret, {}, undefined)
        console.log(decoded)
        return {
            "isAuthorized": true,
            "context": decoded
        }
    } catch (e) {
        return {
            "isAuthorized": false,
            "context": {}
        }
    }
}