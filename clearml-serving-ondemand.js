module.exports = function(RED) {
    const request = require('request');  

    function ClearMLServingOnDemandAuthNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var s4cUtility = require("./snap4city-utility.js");
        const logger = s4cUtility.getLogger(RED, node);
        node.on('input', function(msg) {

            logger.info('Received input message', { msg: msg });

            node.s4cAuth = RED.nodes.getNode(config.authentication);

            const uid = s4cUtility.retrieveAppID(RED);
            var accessToken = s4cUtility.retrieveAccessToken(RED, node, config.authentication, uid);

            // Log the access token to the debug bar
            node.log("Access Token: " + accessToken);

            // Check if accessToken is empty or invalid and stop execution if it is
            if (typeof accessToken == "undefined" || accessToken == "" || accessToken == "r") {
                const errorMsg = "Authentication failed: Access token is missing or invalid";
                logger.error(errorMsg, { msg: msg });
                node.error(errorMsg, msg);
                msg.payload = {status: "ko", error: errorMsg};
                node.send(msg);
                return;
            }

            // Use properties from msg.payload with fallbacks to defaultConfig
            var machine_id = msg.payload.machine_id || config.machine_id;  // Assuming defaultConfig might have a url

            if (!machine_id) {
                const errorMsg = "Machine ID is missing";
                logger.error(errorMsg, { msg: msg });
                node.error(errorMsg, msg);
                msg.payload = { status: "ko", error: errorMsg };
                node.send(msg);
                return;
            }

            // Use properties from msg.payload with fallbacks to defaultConfig
            var endpoint = msg.payload.endpoint || config.endpoint;  // Assuming defaultConfig might have a url

            if (!endpoint) {
                const errorMsg = "Endpoint is missing";
                logger.error(errorMsg, { msg: msg });
                node.error(errorMsg, msg);
                msg.payload = { status: "ko", error: errorMsg };
                node.send(msg);
                return;
            }

            var body = {
                access_token: accessToken,
                machine_id: machine_id,
                endpoint: endpoint,
                params: msg.payload.input || config.input
            };

            logger.info('Sending HTTP POST request', { body: body });

            request.post({
                url: 'https://www.snap4city.org/clearml/serve/ondemand',
                body: body,
                json: true  // Ensures the body is sent as JSON and the response is parsed as JSON
            }, function (error, response, body) {
                if (error) {
                    const errorMsg = "Error in ClearML On-Demand Serving Auth node: " + error.message;
                    logger.error(errorMsg, { error: error, msg: msg });
                    node.error(errorMsg, msg);
                    msg.payload = {
                        status: "ko",
                        error: error.message
                    };
                } else {
                    logger.info('HTTP POST request completed', { response: response });

                    if (response.statusCode >= 200 && response.statusCode <= 299) {
                        msg.payload = {
                            status: "ok",
                            response: body
                        };
                        logger.info('Request successful', { response: body });
                    } else {
                        const errorMsg = "Unexpected server response: " + response.statusCode;
                        msg.payload = {
                            status: "ko",
                            error: errorMsg,
                            details: body
                        };
                        logger.error(errorMsg, { response: response, body: body });
                    }
                }
                node.send(msg);
            });
        });
    }
    RED.nodes.registerType("clearml-serving-ondemand", ClearMLServingOnDemandAuthNode);
};