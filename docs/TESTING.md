# Testing Guide for Trmx Agent

This document provides an overview of the testing setup for the Trmx Agent application.

## Testing Structure

The tests are organized as follows:

```
src/
└── __tests__/
    ├── e2e/              # End-to-end tests
    ├── integration/      # Integration tests
    ├── unit/             # Unit tests
    │   ├── main/         # Tests for main process code
    │   ├── renderer/     # Tests for renderer process code
    │   └── shared/       # Tests for shared code
    ├── mocks/            # Mock implementations
    └── setup.ts          # Test setup and global mocks
```

## Test Categories

### Unit Tests

Unit tests are focused on testing individual functions or classes in isolation. They are located in `src/__tests__/unit/`.

- **Main Process Tests**: Test the Electron main process functionality, particularly the AirtrainService.
- **Renderer Utils Tests**: Test utility functions used in the renderer process.
- **Component Tests**: Test individual React components.

### Integration Tests

Integration tests verify that different parts of the application work together correctly. They are located in `src/__tests__/integration/`.

- **Fireworks Integration**: Tests the integration with the Fireworks AI API.
- **Provider Initialization**: Tests the flow of initializing AI providers.

### End-to-End Tests

End-to-end tests simulate complete user interactions from start to finish. They are located in `src/__tests__/e2e/`.

- **Chat Flow**: Tests the full chat conversation flow from setup to multi-turn conversation.

## Mock Setup

The application uses several mocks to simulate dependencies:

1. **Electron API Mocks**: Simulates the Electron IPC, File System, and other APIs.
2. **React Markdown Mocks**: Provides mock implementations of the Markdown renderer.
3. **Config Mocks**: Mocks configuration methods for testing UI components.
4. **AI Service Mocks**: Mocks the AI service for predictable test responses.

## Running Tests

You can run all tests with:

```bash
npm test
```

To run specific test categories:

```bash
# Run all unit tests
npm test -- src/__tests__/unit

# Run main process unit tests
npm test -- src/__tests__/unit/main

# Run specific test file
npm test -- src/__tests__/unit/renderer/utils/chat.test.tsx
```

## Debugging Tests

When tests fail, look for:

1. Missing or incorrect mocks
2. Asynchronous test timing issues (use `waitFor` appropriately)
3. Component prop type mismatches
4. DOM element selectors that might have changed

## Adding New Tests

When adding new tests:

1. Follow the existing directory structure based on the type of test.
2. Ensure proper mocking of dependencies.
3. For component tests, focus on user interactions rather than implementation details.
4. For service tests, verify both successful operations and error handling.

## Troubleshooting Common Issues

- **ESM Module Issues**: Some dependencies use ESM format which requires special handling in Jest. Use the mock files in `src/__tests__/mocks/` for these.
- **React Component Prop Type Issues**: Make sure component prop types match between component definition and test usage.
- **Asynchronous Test Failures**: Use `waitFor` to handle async state updates, and `async/await` for test functions that contain async operations. 