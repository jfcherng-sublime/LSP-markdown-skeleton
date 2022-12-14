"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisposableStore = exports.Disposable = exports.disposeAll = exports.MultiDisposeError = void 0;
class MultiDisposeError extends Error {
    constructor(errors) {
        super(`Encountered errors while disposing of store. Errors: [${errors.join(', ')}]`);
        this.errors = errors;
    }
}
exports.MultiDisposeError = MultiDisposeError;
function disposeAll(disposables) {
    const errors = [];
    for (const disposable of disposables) {
        try {
            disposable.dispose();
        }
        catch (e) {
            errors.push(e);
        }
    }
    if (errors.length === 1) {
        throw errors[0];
    }
    else if (errors.length > 1) {
        throw new MultiDisposeError(errors);
    }
}
exports.disposeAll = disposeAll;
class Disposable {
    constructor() {
        this._isDisposed = false;
        this._disposables = [];
    }
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;
        disposeAll(this._disposables);
    }
    _register(value) {
        if (this._isDisposed) {
            value.dispose();
        }
        else {
            this._disposables.push(value);
        }
        return value;
    }
    get isDisposed() {
        return this._isDisposed;
    }
}
exports.Disposable = Disposable;
class DisposableStore extends Disposable {
    constructor() {
        super(...arguments);
        this.items = new Set();
    }
    dispose() {
        super.dispose();
        disposeAll(this.items);
        this.items.clear();
    }
    add(item) {
        if (this.isDisposed) {
            console.warn('Adding to disposed store. Item will be leaked');
        }
        this.items.add(item);
        return item;
    }
}
exports.DisposableStore = DisposableStore;
