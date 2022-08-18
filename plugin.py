from LSP.plugin.core.typing import Tuple
from lsp_utils import NpmClientHandler
import os


def plugin_loaded():
    LspMarkdownPlugin.setup()


def plugin_unloaded():
    LspMarkdownPlugin.cleanup()


class LspMarkdownPlugin(NpmClientHandler):
    package_name = __package__
    server_directory = "language-server"
    server_binary_path = os.path.join(
        server_directory,
        "markdown-language-features",
        "server",
        "out",
        "node",
        "main.js",
    )

    @classmethod
    def minimum_node_version(cls) -> Tuple[int, int, int]:
        # this should be aligned with VSCode's Nodejs version
        return (16, 0, 0)
