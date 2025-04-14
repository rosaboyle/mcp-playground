# Updating Airtrain for Groq Support

This document provides instructions for updating the airtrain npm package to support Groq in the trmx-agent Electron application.

## Quick Update

To update the airtrain package to the latest version with Groq support:

```bash
# Navigate to the trmx-agent directory
cd airtrain-node/examples/apps/electron/trmx-agent

# Install the latest version of airtrain
npm install airtrain@latest

# Rebuild the application
npm run build

# Start the application
npm start
```

## Manual Integration

If the latest airtrain package doesn't include Groq support yet, you can manually add the Groq client to your project:

1. Create a directory for the Groq client:

```bash
mkdir -p src/integrations/groq
```

2. Copy the Groq client files from the examples:

```bash
cp ../../integrations/groq/*.ts src/integrations/groq/
```

3. Update the import path in airtrain-service.ts:

```typescript
// Change this:
import { GroqClient } from 'airtrain/dist/integrations/groq';

// To this:
import { GroqClient } from '../../integrations/groq';
```

4. Rebuild and start the application:

```bash
npm run build
npm start
```

## Verifying Groq Support

To verify that Groq is properly supported:

1. Start the application
2. Go to the Providers tab
3. You should see "Groq" in the list of available providers
4. Select Groq and enter your API key
5. Try sending a message to verify the integration works

If you see a message saying "This is a mock response from Groq", it means the real Groq client is not available. Follow the steps above to update the airtrain package or manually integrate the Groq client. 