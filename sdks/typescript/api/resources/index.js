"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookEndpoints = exports.threads = exports.meta = exports.messages = exports.internalWebhooks = exports.inboxes = void 0;
__exportStar(require("./inboxes/client/requests/index.js"), exports);
exports.inboxes = __importStar(require("./inboxes/index.js"));
exports.internalWebhooks = __importStar(require("./internalWebhooks/index.js"));
__exportStar(require("./internalWebhooks/types/index.js"), exports);
__exportStar(require("./messages/client/requests/index.js"), exports);
exports.messages = __importStar(require("./messages/index.js"));
__exportStar(require("./messages/types/index.js"), exports);
exports.meta = __importStar(require("./meta/index.js"));
__exportStar(require("./meta/types/index.js"), exports);
__exportStar(require("./threads/client/requests/index.js"), exports);
exports.threads = __importStar(require("./threads/index.js"));
__exportStar(require("./webhookEndpoints/client/requests/index.js"), exports);
exports.webhookEndpoints = __importStar(require("./webhookEndpoints/index.js"));
__exportStar(require("./webhookEndpoints/types/index.js"), exports);
//# sourceMappingURL=index.js.map