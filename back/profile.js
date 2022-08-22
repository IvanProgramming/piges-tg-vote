module.exports.handler = async function(request, context) {
    let data = request.requestContext.authorizer
    console.log(request)
    return {
        "statusCode": 200,
        "body": JSON.stringify({
            "data": data
        })
    }
}