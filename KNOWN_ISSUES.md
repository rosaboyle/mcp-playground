# Known Issues in MCP Playground

This document lists the currently known issues in MCP Playground. We're working on resolving these issues in future releases.

## MCP Server Configuration

1. When you add a new MCP server which has the same name of the existing server it will not throw an error. This will be fixed soon.

2. MCP server currently expect that there is a "envs" key. This must be optional. Please use an empty list as of now. This will be fixed soon.

3. If the MCP server connections fail there is no visual indication that it failed. Instead it is just logged in the logs. And the server shows connected with no tools and prompts.

## UI Issues

4. The MCP playground page is not scrollable as of now. When you add too many MCP servers the tools list will just be hidden.

## Packaging and Distribution

5. `npm run package` and `npm run package:mac` do not work properly because on Mac Sequoia. These work properly in the CI pipelines though.

6. The public repository is not loaded with the necessary keys to notarize this App. The Mac package will fail in CI CD.

## Reporting New Issues

If you encounter any additional issues not listed here, please report them by opening an issue in the GitHub repository at https://github.com/rosaboyle/mcp-playground/issues. 