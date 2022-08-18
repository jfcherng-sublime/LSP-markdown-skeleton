"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerValidateSupport = void 0;
const md = require("vscode-markdown-languageservice");
const dispose_1 = require("vscode-markdown-languageservice/out/util/dispose");
const vscode_uri_1 = require("vscode-uri");
const defaultDiagnosticOptions = {
    validateFileLinks: md.DiagnosticLevel.ignore,
    validateReferences: md.DiagnosticLevel.ignore,
    validateFragmentLinks: md.DiagnosticLevel.ignore,
    validateMarkdownFileLinkFragments: md.DiagnosticLevel.ignore,
    ignoreLinks: [],
};
function convertDiagnosticLevel(enabled) {
    switch (enabled) {
        case 'error': return md.DiagnosticLevel.error;
        case 'warning': return md.DiagnosticLevel.warning;
        case 'ignore': return md.DiagnosticLevel.ignore;
        default: return md.DiagnosticLevel.ignore;
    }
}
function getDiagnosticsOptions(config) {
    const settings = config.getSettings();
    if (!settings) {
        return defaultDiagnosticOptions;
    }
    return {
        validateFileLinks: convertDiagnosticLevel(settings.markdown.experimental.validate.fileLinks.enabled),
        validateReferences: convertDiagnosticLevel(settings.markdown.experimental.validate.referenceLinks.enabled),
        validateFragmentLinks: convertDiagnosticLevel(settings.markdown.experimental.validate.fragmentLinks.enabled),
        validateMarkdownFileLinkFragments: convertDiagnosticLevel(settings.markdown.experimental.validate.fileLinks.markdownFragmentLinks),
        ignoreLinks: settings.markdown.experimental.validate.ignoreLinks,
    };
}
function registerValidateSupport(connection, workspace, ls, config, logger) {
    let diagnosticOptions = defaultDiagnosticOptions;
    function updateDiagnosticsSetting() {
        diagnosticOptions = getDiagnosticsOptions(config);
    }
    const subs = [];
    const manager = ls.createPullDiagnosticsManager();
    subs.push(manager);
    subs.push(manager.onLinkedToFileChanged(() => {
        // TODO: We only need to refresh certain files
        connection.languages.diagnostics.refresh();
    }));
    const emptyDiagnosticsResponse = Object.freeze({ kind: 'full', items: [] });
    connection.languages.diagnostics.on(async (params, token) => {
        logger.log(md.LogLevel.Trace, 'Server: connection.languages.diagnostics.on', params.textDocument.uri);
        if (!config.getSettings()?.markdown.experimental.validate.enabled) {
            return emptyDiagnosticsResponse;
        }
        const uri = vscode_uri_1.URI.parse(params.textDocument.uri);
        if (!workspace.hasMarkdownDocument(uri)) {
            return emptyDiagnosticsResponse;
        }
        const document = await workspace.openMarkdownDocument(uri);
        if (!document) {
            return emptyDiagnosticsResponse;
        }
        const diagnostics = await manager.computeDiagnostics(document, diagnosticOptions, token);
        return {
            kind: 'full',
            items: diagnostics,
        };
    });
    updateDiagnosticsSetting();
    subs.push(config.onDidChangeConfiguration(() => {
        updateDiagnosticsSetting();
        connection.languages.diagnostics.refresh();
    }));
    return {
        dispose: () => {
            (0, dispose_1.disposeAll)(subs);
        }
    };
}
exports.registerValidateSupport = registerValidateSupport;
