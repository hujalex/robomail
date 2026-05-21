"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResponseBody = getResponseBody;
const json_js_1 = require("../json.js");
const BinaryResponse_js_1 = require("./BinaryResponse.js");
async function getResponseBody(response, responseType) {
    switch (responseType) {
        case "binary-response":
            return (0, BinaryResponse_js_1.getBinaryResponse)(response);
        case "blob":
            return await response.blob();
        case "arrayBuffer":
            return await response.arrayBuffer();
        case "sse":
            if (response.body == null) {
                return {
                    ok: false,
                    error: {
                        reason: "body-is-null",
                        statusCode: response.status,
                    },
                };
            }
            return response.body;
        case "streaming":
            if (response.body == null) {
                return {
                    ok: false,
                    error: {
                        reason: "body-is-null",
                        statusCode: response.status,
                    },
                };
            }
            return response.body;
        case "text":
            return await response.text();
    }
    // if responseType is "json" or not specified, try to parse as JSON
    const text = await response.text();
    if (text.length > 0) {
        try {
            const responseBody = (0, json_js_1.fromJson)(text);
            return responseBody;
        }
        catch (_err) {
            return {
                ok: false,
                error: {
                    reason: "non-json",
                    statusCode: response.status,
                    rawBody: text,
                },
            };
        }
    }
    return undefined;
}
//# sourceMappingURL=getResponseBody.js.map