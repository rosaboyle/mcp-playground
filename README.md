# TRMX MCP Playground

**The Postman for MCPs**  
A powerful, open-source desktop tool for exploring, debugging, and monitoring Model Context Protocol (MCP) servers—with built-in LLM integration.  
Learn more and join our community at [trmx.ai](https://trmx.ai).

---

## Table of Content

1. [What is TRMX MCP Playground?](#what-is-trmx-mcp-playground)
2. [Why We Built It](#why-we-built-it)
3. [Welcome: Open Source & Developer Community](#welcome-open-source--developer-community)
4. [Key Features](#key-features)
5. [Installation](#installation)
6. [Usage Guide](#usage-guide)
7. [Integration Examples](#integration-examples)
8. [Use Cases](#use-cases)
9. [Troubleshooting](#troubleshooting)
10. [Command-Line Exploration](#command-line-exploration)
11. [License & Acknowledgments](#license--acknowledgments)

---

## What is TRMX MCP Playground?

TRMX MCP Playground is your go-to tool for building, testing, debugging, and monitoring MCP servers.  
Think of it as "Postman, but for MCPs."  
It’s designed for developers working with the Model Context Protocol (MCP)—a standard that lets LLMs (Large Language Models) discover and use external tools, resources, and prompts in a consistent way.

- Learn more about MCP: [pai.dev/model-context-protocol-and-why-it-matters-for-ai-agents-88e0e0a7bb73](https://pai.dev/model-context-protocol-and-why-it-matters-for-ai-agents-88e0e0a7bb73)
---

## Why We Built It

We noticed the developer experience for MCP was broken—testing, debugging, and monitoring MCP servers was painful.  
Our vision is twofold:

1. **Stage 1:** Build a local MCP playground for developers to easily build, test, debug, and monitor their local MCPs.
2. **Stage 2:** Launch a serverless MCP platform so anyone can deploy, scale, and share MCPs without managing infrastructure.

Read more about our motivation and roadmap:  
- [Build Local MCP Server or Remote Serverless MCP? (Medium)](https://medium.com/trmx-ai/build-local-mcp-server-or-remote-serverless-mcp-58fc195fbe28)  
- [First Release Details (Medium)](https://medium.com/trmx-ai/mcp-playground-an-attemt-to-fix-the-broken-experience-for-the-mcp-client-developers-a50dd2cd999f)

---

## Welcome: Open Source & Developer Community

We made TRMX MCP Playground open source because we believe the future of MCP should be built by the community, for the community.  
We’re not just looking for users—we’re looking for collaborators, contributors, and pioneers.

- **Official Working Group:**  
  We run an open, official working group to guide the project’s direction, set priorities, and build the next generation of MCP tools together.
- **Weekly Meetings:**  
  Join our regular sessions to discuss features, share feedback, and help shape the roadmap. Calendar updates coming soon!
- **Open Collaboration:**  
  All contributions are welcome—code, docs, ideas, and feedback.  
  If you want to help define how MCP servers are built and used, you’re in the right place.

**Join us:**  
- [Discord Community](https://discord.gg/DsRcA3GwPy)  
- [trmx.ai](https://trmx.ai)
---

## Key Features

- **MCP Server Debugging**: Connect to any MCP server and explore its tools, resources, and prompts.
- **Built-in LLM Integration**: Connect directly with LLM providers like Fireworks AI and Groq (more coming soon).
- **Tool & Resource Exploration**: List and inspect all available tools, resources, and prompts from MCP servers.
- **Multiple Parallel Connections**: Connect to and monitor multiple MCP servers at once.
- **Comprehensive Logging**: Detailed local logs for all operations and responses.
- **Modern Interface**: Clean, intuitive UI for easy interaction.
- **Open Source**: 100% open, MIT-licensed, and built with community feedback.

![MCP Playground Application](public/application.png)
---

## Installation

**Prerequisites**
- Node.js (v20.16.0 or higher)
- npm (10.8.1 or higher)

### Installation Steps

```bash
# Clone the repository
git clone https://github.com/rosaboyle/mcp-playground.git

# Navigate to the project directory
cd mcp-playground

# Install dependencies
npm install

# Build the project
npm run build

# Start the application
npm start
```

## Usage Guide

### Setting Up API Keys

You can easily set up your API keys through the application's user interface:

1. Open the application and navigate to the "Providers" section
2. Click "Set API Key" for the provider you want to configure
3. Enter your API key in the dialog box and save

![Setting up API Keys](public/load_keys.png)

### Adding MCP Servers

To add a new MCP server through the user interface:

1. Navigate to "MCP Playground" in the application
2. Click "Add Server" and fill in the server details
3. Click "Save" to store the server configuration

![Adding MCP Server - Step 1](public/add_mcp_server_1.png)
![Adding MCP Server - Step 2](public/add_mcp_server_2.png)

## Adding New MCP Servers

To add a new MCP server:

1. Use the "Add Server" button in the MCP Playground section
2. Specify the server name, command, arguments, and environment variables
3. Save the configuration

## Development

```bash
# Start the application in development mode
npm run dev
```

### Testing

Run the test suite:

```bash
npm test
```

For detailed information on testing, see [TESTING.md](docs/TESTING.md).

## Integration Examples

### Fireworks AI Integration

MCP Playground allows Fireworks AI models to:
1. Discover available tools from MCP servers
2. Call these tools when appropriate
3. Process the results from tool calls
4. Generate coherent responses based on the tool outputs

For more details, see [FIREWORKS_MCP_INTEGRATION.md](docs/FIREWORKS_MCP_INTEGRATION.md).

### Groq Integration

The Groq integration enables:
- Initializing the Groq client with an API key
- Making real API calls to the Groq API
- Streaming chat completions from Groq AI models
- Forwarding events from the stream to the renderer process

For more details, see [GROQ_INTEGRATION.md](docs/GROQ_INTEGRATION.md).

## Use Cases

- **API Testing**: Debug and test your MCP server implementations
- **Tool Development**: Develop and test new tools for MCP servers
- **LLM Integration**: Test how different LLMs interact with MCP tools
- **Education**: Learn about the Model Context Protocol
- **Development**: Build applications that leverage MCP and LLMs

## Troubleshooting

### Common Issues

- **Connection Errors**: Ensure your MCP server is running and the command/args in mcp.json are correct
- **API Key Issues**: Verify that you've set the correct API keys in your .env file
- **Tool Call Failures**: Check the server logs for errors in tool implementation

For specific integration issues:
- See [FIREWORKS_INTEGRATION.md](docs/FIREWORKS_INTEGRATION.md) for Fireworks-specific help
- See [GROQ_INTEGRATION.md](docs/GROQ_INTEGRATION.md) for Groq-specific help

For a list of known issues and limitations, see [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

### Command-Line Exploration

For advanced users or troubleshooting, you can also explore MCP servers via command line:

```bash
npm run mcp-client
```

This will:
- Connect to the configured MCP server
- List all available tools
- List all available resources
- List all available prompts

### Testing LLM Integrations via Command Line

The application supports testing various LLM providers with MCP servers via command line:

#### Fireworks AI + MCP

```bash
# Test the Fireworks MCP integration
npx ts-node src/test_fireworks_mcp.ts

# Run in interactive mode
npx ts-node src/test_fireworks_mcp.ts --interactive
```

#### Groq + MCP

```bash
# Test the Groq integration
npx ts-node src/test_groq.ts
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on how to contribute to this project.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors who have helped build and improve this tool
- Special thanks to the MCP community for developing and promoting this standard 
