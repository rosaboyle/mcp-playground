# Groq Integration with Airtrain

This document outlines the implementation of Groq in the trmx-agent Electron application using the airtrain npm package.

## Installation Requirements

To properly use the Groq integration, make sure you have the latest version of the airtrain npm package that includes Groq support:

```bash
npm install airtrain@latest
```

If the Groq client is not available, the application will use a mock implementation that displays a warning message.

## Implementation Details

### 1. AirtrainService Updates

The `AirtrainService` class in `src/main/services/airtrain-service.ts` has been updated to use the real Groq client from the airtrain npm package:

```typescript
import { GroqClient } from 'airtrain/dist/integrations/groq';
```

This allows the application to:
- Initialize the Groq client with an API key
- Make real API calls to the Groq API
- Stream chat completions from Groq AI models
- Forward events from the stream to the renderer process

### 2. Path Updates

The import paths have been updated to correctly reference the airtrain package:

```typescript
const PROVIDER_MODULES: Record<string, string> = {
    fireworks: 'airtrain/dist/integrations/fireworks',
    groq: 'airtrain/dist/integrations/groq'
};
```

### 3. Content Security Policy

The Content Security Policy in `public/index.html` already includes 'unsafe-eval', which is required for the Groq client to operate properly:

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-eval';">
```

### 4. Event Handling 

The streaming implementation handles events from the Groq client using the async iterator pattern:

```typescript
for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content || '';
    // Process content...
}
```

## Testing

A test script (`src/test_groq.ts`) has been created to verify that the integration works correctly. The script tests:

1. Initializing the Groq client
2. Basic chat completion
3. Streaming chat completion

To run the test script:

```bash
npx ts-node src/test_groq.ts
```

## Usage

To use the Groq integration in the application:

1. Set the Groq API key in the provider settings
2. Select the Groq provider as the active provider
3. Choose a Groq model (e.g., 'meta-llama/llama-4-scout-17b-16e-instruct')
4. Send a message in the chat interface

## Troubleshooting

If you encounter any issues with the integration:

1. Verify that you have a valid Groq API key
2. Check that the provider is initialized successfully
3. Look for errors in the application logs
4. Try running the test script to verify the basic functionality
5. Make sure you have the latest version of the airtrain npm package with Groq support
6. If you see a message saying "This is a mock response from Groq", it means the real Groq client is not available

## Additional Information

For more information on the Groq API, visit: https://console.groq.com/docs
For more information on the airtrain package, refer to the airtrain documentation. 