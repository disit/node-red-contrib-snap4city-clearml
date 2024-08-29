module.exports = function(RED) {
    const request = require('request');
    function ClearmlServingEnqueueAuthNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        node.on('input', function(msg) {

            logger.info('Received input message', { msg: msg });

            node.s4cAuth = RED.nodes.getNode(config.authentication);

            const uid = s4cUtility.retrieveAppID(RED);
            var accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

            // Check if accessToken is empty or invalid and stop execution if it is
            if (typeof accessToken == "undefined" || accessToken == "" || accessToken == "r") {
                const errorMsg = "Authentication failed: Access token is missing or invalid";
                logger.error(errorMsg, { msg: msg });
                node.error(errorMsg, msg);
                msg.payload = {status: "ko", error: errorMsg};
                node.send(msg);
                return;
            }

            // Validate and set required fields, fallback to config.payload if necessary
            var task_id = msg.payload.task_id || config.task_id;
            if (!task_id) {
                const errorMsg = "Task ID is missing";
                logger.error(errorMsg, { msg: msg });
                node.error(errorMsg, msg);
                msg.payload = { status: "ko", error: errorMsg };
                node.send(msg);
                return;
            }

            var queue_name = msg.payload.queue_name || config.queue_name;
            var input_params = msg.payload.input || config.input || {};

            var body = {
                access_token: accessToken,
                task_id: task_id,
                queue: queue_name,
                params: input_params
            };

            logger.info('Sending HTTP POST request', { body: body });

            // Make the HTTP POST request
            request.post({
                url: 'https://www.snap4city.org/clearml/serve/enqueue_task',
                headers: {
                    "accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body) // Convert body object to JSON string
            }, function(error, response, body) {
                if (error) {
                    const errorMsg = "HTTP request error: " + error.message;
                    logger.error(errorMsg, { error: error, msg: msg });
                    node.error(errorMsg, msg);
                    msg.payload = {
                        status: "ko",
                        error: error.message
                    };
                    node.send(msg);
                    return;
                }

                // Process the response
                var r;
                try {
                    r = JSON.parse(body);
                } catch (e) {
                    const errorMsg = "Failed to parse response body";
                    logger.error(errorMsg, { body: body, error: e, msg: msg });
                    node.error(errorMsg, msg);
                    msg.payload = {
                        status: "ko",
                        error: errorMsg,
                        responseBody: body
                    };
                    node.send(msg);
                    return;
                }

                // Check response status
                if (response.statusCode >= 200 && response.statusCode <= 299) {
                    if (r.status === "queued") {
                        msg.payload = {
                            status: "ok",
                            response: r
                        };
                        logger.info('Task successfully queued', { response: r });
                    } else {
                        msg.payload = {
                            status: "ko",
                            response: r
                        };
                        logger.error('Task queuing failed', { response: r });
                    }
                } else {
                    const errorMsg = "Unexpected server response code: " + response.statusCode;
                    msg.payload = {
                        status: "ko",
                        error: errorMsg,
                        response: r
                    };
                    logger.error(errorMsg, { response: response, body: r });
                }

                node.send(msg);
            });
        });
    }
    RED.nodes.registerType("clearml-serving-enqueue", ClearmlServingEnqueueAuthNode);
};