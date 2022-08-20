<h1>This is NOT a working plugin but just a skeleton!</h1>

The server asks the client to parse Markdown, which makes no sense...
I am not going to implement that since this should be done on the server side in my opinion.

In their server design, that is a must for the it to work. If you are interested in implementing it, you can read:
https://github.com/microsoft/vscode/tree/main/extensions/markdown-language-features/server#custom-requests

---

# LSP-markdown

Markdown support for Sublime's LSP plugin provided through [VS Code's Markdown language server](https://github.com/microsoft/vscode/tree/main/extensions/markdown-language-features/server).

## Installation

- Install [LSP](https://packagecontrol.io/packages/LSP) and `LSP-markdown` from Package Control.
- Restart Sublime.

## Configuration

There are some ways to configure the package and the language server.

- From `Preferences > Package Settings > LSP > Servers > LSP-markdown`
- From the command palette `Preferences: LSP-markdown Settings`
