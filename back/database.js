const ydb = require('ydb-sdk')


function resultSetToObjects(resultSet) {
    let objects = Array()
    for (let i = 0; i < resultSet.rows.length; i++) {
        let object = {}
        let row = resultSet.rows[i]
        for (let q = 0; q < resultSet.columns.length; q++) {
            if (row.items[q].textValue === null) {
                object[resultSet.columns[q].name] = row.items[q].uint64Value.low
            } else {
                object[resultSet.columns[q].name] = row.items[q].textValue
            }

        }
        objects.push(object)
    }
    return objects
}

async function getCandidates(session) {
    let getIntegrationQuery = `SELECT id, name FROM candidates`
    let preparedQuery = await session.prepareQuery(getIntegrationQuery)
    let {resultSets} = await session.executeQuery(preparedQuery)
    return resultSetToObjects(resultSets[0])
}

async function getCandidatesRatings(session) {
    let getRatingQuery = `
        SELECT 
        COUNT(user_id) as votes,
        candidate_id as id
        FROM votes
        GROUP BY candidate_id
    `
    let preparedQuery = await session.prepareQuery(getRatingQuery)
    let {resultSets} = await session.executeQuery(preparedQuery)
    return resultSetToObjects(resultSets[0])
}

async function saveVote(session, userId, candidateId) {
    let creatVoteQuery = `
    DECLARE $userId as Utf8;
    DECLARE $candidateId as Uint64;
    UPSERT INTO votes (user_id, candidate_id) VALUES ($userId, $candidateId)`
    let preparedQuery = await session.prepareQuery(creatVoteQuery)
    await session.executeQuery(preparedQuery, {
        "$userId": ydb.TypedValues.utf8(userId),
        "$candidateId": ydb.TypedValues.uint64(candidateId)
    })
    return userId
}

module.exports = {
    saveVote: saveVote,
    getCandidates: getCandidates,
    getCandidatesRatings: getCandidatesRatings
};