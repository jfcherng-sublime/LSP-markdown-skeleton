"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.VsCodeClientWorkspace = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const md = require("vscode-markdown-languageservice");
const vscode_uri_1 = require("vscode-uri");
const protocol = require("./protocol");
const arrays_1 = require("./util/arrays");
const file_1 = require("./util/file");
const limiter_1 = require("./util/limiter");
const resourceMap_1 = require("./util/resourceMap");
const schemes_1 = require("./util/schemes");
class VsCodeClientWorkspace {
    constructor(connection, config, documents, notebooks, logger) {
        this.connection = connection;
        this.config = config;
        this.documents = documents;
        this.notebooks = notebooks;
        this.logger = logger;
        this._onDidCreateMarkdownDocument = new vscode_languageserver_1.Emitter();
        this.onDidCreateMarkdownDocument = this._onDidCreateMarkdownDocument.event;
        this._onDidChangeMarkdownDocument = new vscode_languageserver_1.Emitter();
        this.onDidChangeMarkdownDocument = this._onDidChangeMarkdownDocument.event;
        this._onDidDeleteMarkdownDocument = new vscode_languageserver_1.Emitter();
        this.onDidDeleteMarkdownDocument = this._onDidDeleteMarkdownDocument.event;
        this._documentCache = new resourceMap_1.ResourceMap();
        this._utf8Decoder = new TextDecoder('utf-8');
        this._watcherPool = 0;
        this._watchers = new Map();
        this._workspaceFolders = [];
        documents.onDidOpen(e => {
            this._documentCache.delete(vscode_uri_1.URI.parse(e.document.uri));
            if (this.isRelevantMarkdownDocument(e.document)) {
                this._onDidCreateMarkdownDocument.fire(e.document);
            }
        });
        documents.onDidChangeContent(e => {
            if (this.isRelevantMarkdownDocument(e.document)) {
                this._onDidChangeMarkdownDocument.fire(e.document);
            }
        });
        documents.onDidClose(e => {
            const uri = vscode_uri_1.URI.parse(e.document.uri);
            this._documentCache.delete(uri);
            if (this.isRelevantMarkdownDocument(e.document)) {
                this._onDidDeleteMarkdownDocument.fire(uri);
            }
        });
        connection.onDidChangeWatchedFiles(async ({ changes }) => {
            for (const change of changes) {
                const resource = vscode_uri_1.URI.parse(change.uri);
                this.logger.log(md.LogLevel.Trace, 'VsCodeClientWorkspace: onDidChangeWatchedFiles', `${change.type}: ${resource}`);
                switch (change.type) {
                    case vscode_languageserver_1.FileChangeType.Changed: {
                        this._documentCache.delete(resource);
                        const document = await this.openMarkdownDocument(resource);
                        if (document) {
                            this._onDidChangeMarkdownDocument.fire(document);
                        }
                        break;
                    }
                    case vscode_languageserver_1.FileChangeType.Created: {
                        const document = await this.openMarkdownDocument(resource);
                        if (document) {
                            this._onDidCreateMarkdownDocument.fire(document);
                        }
                        break;
                    }
                    case vscode_languageserver_1.FileChangeType.Deleted: {
                        this._documentCache.delete(resource);
                        this._onDidDeleteMarkdownDocument.fire(resource);
                        break;
                    }
                }
            }
        });
        connection.onRequest(protocol.fs_watcher_onChange, params => {
            this.logger.log(md.LogLevel.Trace, 'VsCodeClientWorkspace: fs_watcher_onChange', `${params.kind}: ${params.uri}`);
            const watcher = this._watchers.get(params.id);
            if (!watcher) {
                return;
            }
            switch (params.kind) {
                case 'create':
                    watcher.onDidCreate.fire(vscode_uri_1.URI.parse(params.uri));
                    return;
                case 'change':
                    watcher.onDidChange.fire(vscode_uri_1.URI.parse(params.uri));
                    return;
                case 'delete':
                    watcher.onDidDelete.fire(vscode_uri_1.URI.parse(params.uri));
                    return;
            }
        });
    }
    listen() {
        this.connection.workspace.onDidChangeWorkspaceFolders(async () => {
            this.workspaceFolders = (await this.connection.workspace.getWorkspaceFolders() ?? []).map(x => vscode_uri_1.URI.parse(x.uri));
        });
    }
    get workspaceFolders() {
        return this._workspaceFolders;
    }
    set workspaceFolders(value) {
        this._workspaceFolders = value;
    }
    async getAllMarkdownDocuments() {
        const maxConcurrent = 20;
        const foundFiles = new resourceMap_1.ResourceMap();
        const limiter = new limiter_1.Limiter(maxConcurrent);
        // Add files on disk
        const resources = await this.connection.sendRequest(protocol.findMarkdownFilesInWorkspace, {});
        const onDiskResults = await Promise.all(resources.map(strResource => {
            return limiter.queue(async () => {
                const resource = vscode_uri_1.URI.parse(strResource);
                const doc = await this.openMarkdownDocument(resource);
                if (doc) {
                    foundFiles.set(resource);
                }
                return doc;
            });
        }));
        // Add opened files (such as untitled files)
        const openTextDocumentResults = await Promise.all(this.documents.all()
            .filter(doc => !foundFiles.has(vscode_uri_1.URI.parse(doc.uri)) && this.isRelevantMarkdownDocument(doc)));
        return (0, arrays_1.coalesce)([...onDiskResults, ...openTextDocumentResults]);
    }
    hasMarkdownDocument(resource) {
        return !!this.documents.get(resource.toString());
    }
    async openMarkdownDocument(resource) {
        const existing = this._documentCache.get(resource);
        if (existing) {
            return existing;
        }
        const matchingDocument = this.documents.get(resource.toString());
        if (matchingDocument) {
            this._documentCache.set(resource, matchingDocument);
            return matchingDocument;
        }
        if (!(0, file_1.looksLikeMarkdownPath)(this.config, resource)) {
            return undefined;
        }
        try {
            const response = await this.connection.sendRequest(protocol.fs_readFile, { uri: resource.toString() });
            // TODO: LSP doesn't seem to handle Array buffers well
            const bytes = new Uint8Array(response);
            // We assume that markdown is in UTF-8
            const text = this._utf8Decoder.decode(bytes);
            const doc = vscode_languageserver_textdocument_1.TextDocument.create(resource.toString(), 'markdown', 0, text);
            this._documentCache.set(resource, doc);
            return doc;
        }
        catch (e) {
            return undefined;
        }
    }
    async stat(resource) {
        this.logger.log(md.LogLevel.Trace, 'VsCodeClientWorkspace: stat', `${resource}`);
        if (this._documentCache.has(resource) || this.documents.get(resource.toString())) {
            return { isDirectory: false };
        }
        return this.connection.sendRequest(protocol.fs_stat, { uri: resource.toString() });
    }
    async readDirectory(resource) {
        this.logger.log(md.LogLevel.Trace, 'VsCodeClientWorkspace: readDir', `${resource}`);
        return this.connection.sendRequest(protocol.fs_readDirectory, { uri: resource.toString() });
    }
    getContainingDocument(resource) {
        if (resource.scheme === schemes_1.Schemes.notebookCell) {
            const nb = this.notebooks.findNotebookDocumentForCell(resource.toString());
            if (nb) {
                return {
                    uri: vscode_uri_1.URI.parse(nb.uri),
                    children: nb.cells.map(cell => ({ uri: vscode_uri_1.URI.parse(cell.document) })),
                };
            }
        }
        return undefined;
    }
    watchFile(resource, options) {
        const id = this._watcherPool++;
        this.logger.log(md.LogLevel.Trace, 'VsCodeClientWorkspace: watchFile', `(${id}) ${resource}`);
        const entry = {
            resource,
            options,
            onDidCreate: new vscode_languageserver_1.Emitter(),
            onDidChange: new vscode_languageserver_1.Emitter(),
            onDidDelete: new vscode_languageserver_1.Emitter(),
        };
        this._watchers.set(id, entry);
        this.connection.sendRequest(protocol.fs_watcher_create, {
            id,
            uri: resource.toString(),
            options,
            watchParentDirs: true,
        });
        return {
            onDidCreate: entry.onDidCreate.event,
            onDidChange: entry.onDidChange.event,
            onDidDelete: entry.onDidDelete.event,
            dispose: () => {
                this.logger.log(md.LogLevel.Trace, 'VsCodeClientWorkspace: disposeWatcher', `(${id}) ${resource}`);
                this.connection.sendRequest(protocol.fs_watcher_delete, { id });
                this._watchers.delete(id);
            }
        };
    }
    isRelevantMarkdownDocument(doc) {
        return (0, file_1.isMarkdownFile)(doc) && vscode_uri_1.URI.parse(doc.uri).scheme !== 'vscode-bulkeditpreview';
    }
}
exports.VsCodeClientWorkspace = VsCodeClientWorkspace;
