const {Session, serviceClients} = require("@yandex-cloud/nodejs-sdk");
const {GetPayloadRequest} = require("@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/lockbox/v1/payload_service");
const {getCredentialsFromEnv, Driver} = require("ydb-sdk");
const {getCandidates, getCandidatesRatings} = require("./database");

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
    let candidates
    let candidatesWithVotes
    await driver.tableClient.withSession(async (session) => {
        candidates = await getCandidates(session)
        candidatesWithVotes = await getCandidatesRatings(session)
        for (let i = 0; i < candidates.length; i++) {
            candidates[i].votes = 0
            for (let j = 0; j < candidatesWithVotes.length; j++) {
                if (candidates[i].id === candidatesWithVotes[j].id) {
                    candidates[i].votes = candidatesWithVotes[j].votes
                }
            }
        }
    })
    return {
        statusCode: 200,
        body: JSON.stringify({
            ok: true,
            data: candidates
        })
    }
}