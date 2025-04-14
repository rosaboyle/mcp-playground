# Fireworks AI + MCP Integration

This document outlines how Fireworks AI's tool calling capability has been integrated with the Model Context Protocol (MCP) in the trmx-agent application.

## Overview

The integration allows LLMs from Fireworks AI to:
1. Discover available tools from MCP servers
2. Call these tools when appropriate
3. Process the results from tool calls
4. Generate coherent responses based on the tool outputs

This creates a powerful workflow where models can leverage external capabilities through MCP's standardized interface.

## Components

### 1. FireworksMCPService

A dedicated service (`FireworksMCPService`) handles the integration between Fireworks and MCP:

```typescript
import { FireworksModel, Tool } from 'airtrain/dist/integrations/fireworks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
```

The service:
- Initializes Fireworks models
- Manages conversations with tool capabilities
- Converts MCP tools to Fireworks format
- Processes queries and handles tool calls
- Provides event handlers for tool call results

### 2. MCP Service Integration

The existing MCP service has been extended to include new handlers for Fireworks integration:

```typescript
// Initialize Fireworks for MCP tool calls
{
    name: 'mcp-fireworks-init', 
    handler: async (event: any, apiKey: string, modelId?: string) => { ... }
}

// Start a conversation with Fireworks and MCP
{
    name: 'mcp-fireworks-start-conversation', 
    handler: async (event: any, clientId: string, connectionId: string, systemPrompt?: string) => { ... }
}

// Process a query with Fireworks and MCP tools
{
    name: 'mcp-fireworks-process-query', 
    handler: async (event: any, conversationId: string, query: string) => { ... }
}

// End a Fireworks-MCP conversation
{
    name: 'mcp-fireworks-end-conversation', 
    handler: async (event: any, conversationId: string) => { ... }
}
```

### 3. Tool Format Conversion

MCP tools are converted to Fireworks format:

```typescript
// Convert MCP tools to Fireworks format
const fireworksTools: Tool[] = mcpTools.map(tool => ({
    type: 'function',
    function: {
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`,
        parameters: tool.inputSchema || { type: 'object', properties: {} }
    }
}));
```

## How It Works

### 1. Initialization

```typescript
// Initialize FireworksMCPService
fireworksMCPService = new FireworksMCPService();

// Initialize a Fireworks client with API key
fireworksMCPService.initializeClient(apiKey, modelId);
```

### 2. Starting a Conversation

```typescript
// Start a conversation with MCP connection
const conversationId = fireworksMCPService.startConversation(
    clientId,
    mcpConnectionId,
    mcpClient,
    systemPrompt
);
```

### 3. Processing Queries

```typescript
// Process a query with tool capabilities
const response = await fireworksMCPService.processQuery(conversationId, query);
```

This method:
1. Gets available tools from the MCP server
2. Converts them to Fireworks format
3. Sends the query to the Fireworks model with tools
4. Checks if the model wants to call a tool
5. Executes the tool call via MCP
6. Returns the result to the model
7. Generates a final response

### 4. Event Handling

The service emits events for tool call results:

```typescript
// Tool call success event
this.eventEmitter.emit('tool-call-success', {
    connectionId,
    toolCall: { toolName, toolArgs },
    result
});

// Tool call error event
this.eventEmitter.emit('tool-call-error', {
    connectionId,
    toolCall: { toolName, toolArgs },
    error
});
```

## Testing the Integration

A test script is provided at `src/test_fireworks_mcp.ts` which:

1. Creates a simple MCP server with a temperature conversion tool
2. Connects an MCP client to this server
3. Initializes Fireworks LLM
4. Sends a query that should trigger tool use
5. Processes the tool call and response

Run the test with:

```bash
# Run the standard test
npx ts-node src/test_fireworks_mcp.ts

# Run in interactive mode
npx ts-node src/test_fireworks_mcp.ts --interactive
```

## Use Cases

This integration enables numerous powerful use cases:

1. **Data Retrieval**: LLM can query databases or APIs through MCP tools
2. **Calculations**: Complex calculations can be offloaded to specialized tools
3. **External Services**: Connect to external services like weather APIs, stock data, etc.
4. **Code Execution**: Run code in various languages through MCP tools
5. **Document Processing**: Process, analyze or generate documents

## Future Enhancements

Potential future improvements:

1. **Multiple Tool Calls**: Support for parallel tool calls
2. **Streaming**: Stream partial results during tool execution
3. **Tool Selection UI**: Allow users to select which tools to expose
4. **Tool Authentication**: Secure authentication for sensitive tools
5. **Custom Tool Development**: UI for creating custom tools 