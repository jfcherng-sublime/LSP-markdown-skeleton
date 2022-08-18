"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const md = require("vscode-markdown-languageservice");
const vscode_uri_1 = require("vscode-uri");
const config_1 = require("./config");
const configuration_1 = require("./configuration");
const diagnostics_1 = require("./languageFeatures/diagnostics");
const logging_1 = require("./logging");
const protocol = require("./protocol");
const workspace_1 = require("./workspace");
async function startServer(connection) {
    const documents = new vscode_languageserver_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
    const notebooks = new vscode_languageserver_1.NotebookDocuments(documents);
    const configurationManager = new configuration_1.ConfigurationManager(connection);
    let mdLs;
    let workspace;
    connection.onInitialize((params) => {
        const parser = new class {
            constructor() {
                this.slugifier = md.githubSlugifier;
            }
            async tokenize(document) {
                return await connection.sendRequest(protocol.parse, { uri: document.uri.toString() });
            }
        };
        const initOptions = params.initializationOptions;
        const config = (0, config_1.getLsConfiguration)(initOptions ?? {});
        const logger = new logging_1.LogFunctionLogger(connection.console.log.bind(connection.console));
        workspace = new workspace_1.VsCodeClientWorkspace(connection, config, documents, notebooks, logger);
        mdLs = md.createLanguageService({
            workspace,
            parser,
            logger,
            markdownFileExtensions: config.markdownFileExtensions,
            excludePaths: config.excludePaths,
        });
        registerCompletionsSupport(connection, documents, mdLs, configurationManager);
        (0, diagnostics_1.registerValidateSupport)(connection, workspace, mdLs, configurationManager, logger);
        workspace.workspaceFolders = (params.workspaceFolders ?? []).map(x => vscode_uri_1.URI.parse(x.uri));
        return {
            capabilities: {
                diagnosticProvider: {
                    documentSelector: null,
                    identifier: 'markdown',
                    interFileDependencies: true,
                    workspaceDiagnostics: false,
                },
                completionProvider: { triggerCharacters: ['.', '/', '#'] },
                definitionProvider: true,
                documentLinkProvider: { resolveProvider: true },
                documentSymbolProvider: true,
                foldingRangeProvider: true,
                renameProvider: { prepareProvider: true, },
                selectionRangeProvider: true,
                workspaceSymbolProvider: true,
                workspace: {
                    workspaceFolders: {
                        supported: true,
                        changeNotifications: true,
                    },
                }
            }
        };
    });
    connection.onDocumentLinks(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }
        return mdLs.getDocumentLinks(document, token);
    });
    connection.onDocumentLinkResolve(async (link, token) => {
        return mdLs.resolveDocumentLink(link, token);
    });
    connection.onDocumentSymbol(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }
        return mdLs.getDocumentSymbols(document, token);
    });
    connection.onFoldingRanges(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }
        return mdLs.getFoldingRanges(document, token);
    });
    connection.onSelectionRanges(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }
        return mdLs.getSelectionRanges(document, params.positions, token);
    });
    connection.onWorkspaceSymbol(async (params, token) => {
        return mdLs.getWorkspaceSymbols(params.query, token);
    });
    connection.onReferences(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return [];
        }
        return mdLs.getReferences(document, params.position, params.context, token);
    });
    connection.onDefinition(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return undefined;
        }
        return mdLs.getDefinition(document, params.position, token);
    });
    connection.onPrepareRename(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return undefined;
        }
        return mdLs.prepareRename(document, params.position, token);
    });
    connection.onRenameRequest(async (params, token) => {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return undefined;
        }
        return mdLs.getRenameEdit(document, params.position, params.newName, token);
    });
    connection.onRequest(protocol.getReferencesToFileInWorkspace, (async (params, token) => {
        return mdLs.getFileReferences(vscode_uri_1.URI.parse(params.uri), token);
    }));
    connection.onRequest(protocol.getEditForFileRenames, (async (params, token) => {
        return mdLs.getRenameFilesInWorkspaceEdit(params.map(x => ({ oldUri: vscode_uri_1.URI.parse(x.oldUri), newUri: vscode_uri_1.URI.parse(x.newUri) })), token);
    }));
    documents.listen(connection);
    notebooks.listen(connection);
    connection.listen();
}
exports.startServer = startServer;
function registerCompletionsSupport(connection, documents, ls, config) {
    // let registration: Promise<IDisposable> | undefined;
    function update() {
        // TODO: client still makes the request in this case. Figure our how to properly unregister.
        return;
        // const settings = config.getSettings();
        // if (settings?.markdown.suggest.paths.enabled) {
        // 	if (!registration) {
        // 		registration = connection.client.register(CompletionRequest.type);
        // 	}
        // } else {
        // 	registration?.then(x => x.dispose());
        // 	registration = undefined;
        // }
    }
    connection.onCompletion(async (params, token) => {
        try {
            const settings = config.getSettings();
            if (!settings?.markdown.suggest.paths.enabled) {
                return [];
            }
            const document = documents.get(params.textDocument.uri);
            if (document) {
                return await ls.getCompletionItems(document, params.position, params.context, token);
            }
        }
        catch (e) {
            console.error(e.stack);
        }
        return [];
    });
    update();
    return config.onDidChangeConfiguration(() => update());
}
