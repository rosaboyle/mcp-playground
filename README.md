# Trmx Agent - Desktop AI Chat Interface

A powerful, sleek desktop application for interacting with multiple AI language models, built with Airtrain and Electron. Trmx Agent provides a consistent, reliable interface to access AI capabilities directly from your desktop without browser limitations.

![Trmx Agent Application](public/application.png)

## How It Works

Trmx Agent combines the Airtrain framework for AI model interactions with Electron for desktop application capabilities:

- **Airtrain Framework**: Handles communication with various AI providers, manages API keys, and normalizes responses across different models.
- **Electron**: Provides the desktop application shell, enabling native-like performance and features not available in browser environments.
- **React UI**: Delivers a responsive, modern interface for interacting with AI models.

The application uses a main process for handling core functionality (API calls, file system operations) and a renderer process for the user interface. IPC (Inter-Process Communication) connects these processes securely.

## Features

- **Multi-Provider Support**: Chat with various AI models from Fireworks, Groq, OpenAI, Anthropic, and other providers
- **Modern UI**: Clean, responsive interface with light/dark mode support
- **Conversation Management**: Store, categorize, and manage your conversation history
- **Provider Configuration**: Easily switch between different AI providers and models
- **Thinking Process Visibility**: View the AI's thinking process for supported models
- **Rich Content Rendering**: Markdown and code syntax highlighting in responses
- **Streaming Responses**: Real-time streaming of AI responses for immediate feedback
- **Cross-Platform**: Available for macOS, Windows, and Linux

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v7 or higher)

### Dependencies

This project uses the following main dependencies:
- **airtrain**: AI framework for integrating with various LLM providers
- **electron**: Framework for building cross-platform desktop apps
- **react**: UI library for building interfaces
- **posthog**: Analytics tracking library

### Installation

```bash
# Clone the repository
git clone [repository-url]

# Navigate to the project directory
cd airtrain-node/examples/apps/electron/trmx-agent

# Install dependencies
npm install

# Build the project
npm run build

# Start the application
npm start
```

## Development

```bash
# Start the application in development mode
npm run dev
```

This will:
1. Build the project in watch mode
2. Start the Electron app with development tools enabled
3. Auto-reload when changes are detected

### Troubleshooting Development Issues

- **Build Errors**: If you encounter webpack build errors, try cleaning the `dist` directory with `rm -rf dist/` before rebuilding.
- **Missing Dependencies**: If you see modules not found errors, run `npm install` again to ensure all dependencies are installed.
- **Icon Issues**: If icons are not displaying properly during packaging, check the icon files in `assets/icons/` directory.
- **Spotlight Permission Error**: If you encounter "Spotlight does not have permission to open (null)" error on macOS, see [Spotlight Permission Fix](docs/SPOTLIGHT_PERMISSION_FIX.md).
- **ElectronTeamID Error**: If you see "Could not automatically determine ElectronTeamID from identity" during code signing, see [ElectronTeamID Fix](docs/ELECTRON_TEAMID_FIX.md).

## Packaging

```bash
# Package the application for distribution
npm run package
```

This will create distribution packages for your platform (macOS, Windows, or Linux) in the `release` directory.

### Platform-Specific Packaging

```bash
# Package for macOS
npm run package:mac

# Package for Windows
npm run package:win

# Package for Linux
npm run package:linux
```

## GitHub Releases

This project is set up with GitHub Actions for automated releases:

1. To create a new release, push a tag with the version number:
   ```bash
   # Update version in package.json first
   npm version patch # or minor, major
   git push origin main --tags
   ```

2. This will trigger the GitHub Actions workflow which:
   - Builds the app for macOS, Windows, and Linux
   - Creates a GitHub release automatically (not a draft)
   - Attaches all build artifacts to the release

## Continuous Integration

This project uses GitHub Actions for continuous integration:

1. On every push to `main` or `dev` branches and pull requests:
   - Code is built and tested
   - Linting is performed
   - A Linux build is created for testing

2. Different deployment pipelines are triggered based on the branch:
   - `dev` branch: Deploys to development environment
   - `main` branch: Deploys to production environment

You can also manually trigger the CI workflow from the Actions tab in the GitHub repository.

## Using Trmx Agent

### Setting Up API Keys

Before using the application, you'll need to set up API keys for the providers you want to use:

1. Launch the application
2. Navigate to the "Providers" tab via the sidebar
3. Select a provider (e.g., Fireworks or Groq)
4. Click "Set API Key" and enter your API key
5. Save the API key

Alternatively, you can set API keys as environment variables:
- `FIREWORKS_API_KEY` - API key for Fireworks AI
- `GROQ_API_KEY` - API key for Groq
- `OPENAI_API_KEY` - API key for OpenAI
- `ANTHROPIC_API_KEY` - API key for Anthropic
- and so on...

### Creating a New Chat

1. Click the "New Chat" button in the sidebar
2. Type your message in the input box
3. Press Enter or click the send button

### Advanced Usage

#### System Prompts
You can set a system prompt for your conversation to guide the AI's behavior:
1. Start a new chat
2. Click on "Settings" in the top right of the chat window
3. Enter your system prompt in the provided field
4. Click "Save" to apply the prompt to the current session

#### Model Parameters
Adjust advanced model parameters for specific providers:
1. Go to the "Providers" tab
2. Select your provider and model
3. Click "Advanced Settings" to adjust temperature, top-p, and other parameters
4. Save your settings for future conversations

### Managing Chat Sessions

- View and select previous chat sessions in the "Sessions" tab
- Start a new chat by clicking the "New Chat" button
- Delete unwanted conversations by selecting them and clicking the delete icon

### Customizing Settings

In the "Settings" tab, you can adjust various options:
- Choose between light, dark, or system theme
- Toggle the display of AI's thinking process
- Enable/disable markdown rendering
- Change the time display format

## Application Architecture

Trmx Agent follows a typical Electron application architecture:

- **Main Process**: Handles system-level operations, API calls, and core functionality
- **Renderer Process**: Manages the user interface and user interactions
- **IPC Communication**: Facilitates secure communication between main and renderer processes
- **Storage**: Manages local storage of conversations, settings, and credentials

## Configuration

The application stores its configuration files in the following locations:

- `~/.trmx-node/messages/` - Chat history
- `~/.trmx-node/credentials/` - API keys (securely stored)
- `~/.trmx-node/config/` - User settings

## License

MIT 

## Testing

This project includes a comprehensive test suite covering unit, integration, and end-to-end tests. For more information, see the [Testing Guide](TESTING.md).

To run the tests:

```bash
npm test
```

To run specific test categories:

```bash
# Run all unit tests
npm test -- src/__tests__/unit

# Run specific test file
npm test -- src/__tests__/unit/renderer/utils/chat.test.tsx
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request 