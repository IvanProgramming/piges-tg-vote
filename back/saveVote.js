const {Session, serviceClients} = require('@yandex-cloud/nodejs-sdk')
const {GetPayloadRequest} = require("@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/payload_service")
const {createHash, createHmac} = require('crypto');
const jwt = require('jsonwebtoken');
const {Driver, getCredentialsFromEnv} = require('ydb-sdk')
const {getCandidates, saveVote} = require("./database");

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
    let cloudSession = new Session({})
    let lockboxClient = cloudSession.client(serviceClients.PayloadServiceClient)
    let data = await lockboxClient.get(GetPayloadRequest.fromPartial({
        secretId: process.env.SECRET_ID
    }))
    let endpoint = getPayloadByKey(data, 'YDB_ENDPOINT').textValue
    let database = getPayloadByKey(data, 'YDB_DATABASE').textValue
    let driverAuthService = getCredentialsFromEnv()
    let driver = new Driver({
        endpoint: endpoint, database: database, authService: driverAuthService
    })
    let response = {}
    let userId = request.requestContext.authorizer.userId
    let candidateId = request.queryStringParameters.candidate_id
    await driver.tableClient.withSession(async (session) => {
        let candidates = await getCandidates(session)
        console.log(candidates)
        var isCorrect = false;
        for (let i = 0; i < candidates.length; i++) {
            if (candidates[i].id.toString() === candidateId) {
                isCorrect = true
            }
        }
        if (!isCorrect) {
            response =  {
                "statusCode": 422,
                "body": JSON.stringify({"ok": false, "error": "candidateId not found"})
            }
        } else {
            await saveVote(session, userId, candidateId)
            response =  {
                "statusCode": 201,
                "body": JSON.stringify({"ok": true, "data": {}})
            }
        }
    })
    return response
}
