"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.consoleLogger = exports.LogFunctionLogger = void 0;
class LogFunctionLogger {
    constructor(_logFn) {
        this._logFn = _logFn;
    }
    static now() {
        const now = new Date();
        return String(now.getUTCHours()).padStart(2, '0')
            + ':' + String(now.getMinutes()).padStart(2, '0')
            + ':' + String(now.getUTCSeconds()).padStart(2, '0') + '.' + String(now.getMilliseconds()).padStart(3, '0');
    }
    static data2String(data) {
        if (data instanceof Error) {
            if (typeof data.stack === 'string') {
                return data.stack;
            }
            return data.message;
        }
        if (typeof data === 'string') {
            return data;
        }
        return JSON.stringify(data, undefined, 2);
    }
    log(level, title, message, data) {
        this.appendLine(`[${level} ${LogFunctionLogger.now()}] ${title}: ${message}`);
        if (data) {
            this.appendLine(LogFunctionLogger.data2String(data));
        }
    }
    appendLine(value) {
        this._logFn(value);
    }
}
exports.LogFunctionLogger = LogFunctionLogger;
exports.consoleLogger = new LogFunctionLogger(console.log);
