# MCP Explorer

This is a simple tool to explore Model Context Protocol (MCP) servers.

## Features

- Connect to an MCP server using configuration from mcp.json
- List available tools, resources, and prompts
- Display the complete objects for inspection

## Usage

1. Make sure your API key is set in the `.env` file:
   ```
   PERPLEXITY_API_KEY=your_api_key_here
   ```

2. Configure the MCP server in `mcp.json`:
   ```json
   {
     "mcpServers": {
       "perplexity-ask": {
         "command": "npx",
         "args": [
           "-y",
           "server-perplexity-ask"
         ],
         "env": {
           "PERPLEXITY_API_KEY": "YOUR_API_KEY_HERE"
         }
       }
     }
   }
   ```

3. Run the MCP client:
   ```
   npm run mcp-client
   ```

## Adding New Servers

To add a new MCP server:

1. Add a new entry to the `mcpServers` object in `mcp.json`
2. Specify the command, arguments, and environment variables required to run the server
3. Update your `.env` file with any required API keys

## Output

The output will include:

- List of tools
- List of resources
- List of prompts

Each will be output as a complete JSON object for inspection. 