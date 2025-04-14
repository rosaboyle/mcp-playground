import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProviderSelection from '../../../../renderer/components/ProviderSelection';
import { Config } from '../../../../shared/config';

// Mock the electron API
const mockInvoke = jest.fn();
const mockOn = jest.fn();
const mockRemoveAllListeners = jest.fn();

// Mock the provider initialization response
mockInvoke.mockImplementation((channel, ...args) => {
    if (channel === 'ai:initializeProvider') {
        return Promise.resolve(true);
    }
    if (channel === 'ai:listModels') {
        return Promise.resolve(['accounts/fireworks/models/deepseek-r1']);
    }
    return Promise.resolve(null);
});

// Setup mock for electron
window.electron = {
    ipcRenderer: {
        invoke: mockInvoke,
        on: mockOn,
        removeAllListeners: mockRemoveAllListeners,
    },
    // Add other required electron APIs
    fs: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        readdir: jest.fn(),
        mkdir: jest.fn(),
        exists: jest.fn(),
        stat: jest.fn(),
        unlink: jest.fn(),
    },
    path: {
        join: jest.fn((...args) => args.join('/')),
        resolve: jest.fn(),
        basename: jest.fn(),
        dirname: jest.fn(),
        extname: jest.fn(),
    },
    os: {
        homedir: jest.fn(() => '/home/user'),
        platform: jest.fn(() => 'darwin'),
        release: jest.fn(),
    },
    ai: {
        initializeProvider: jest.fn<Promise<boolean>, [string, string]>().mockResolvedValue(true),
        isProviderInitialized: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(false),
        listModels: jest.fn().mockResolvedValue(['accounts/fireworks/models/deepseek-r1']),
        chatCompletion: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }]
        }),
        streamChatCompletion: jest.fn().mockResolvedValue('mock-stream-id'),
        cancelStream: jest.fn().mockResolvedValue(true),
        onStreamResponse: jest.fn().mockReturnValue(() => { }),
        onStreamError: jest.fn().mockReturnValue(() => { }),
        onStreamEnd: jest.fn().mockReturnValue(() => { }),
        removeStreamListeners: jest.fn(),
    },
};

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: jest.fn()
});

// Create a proper mock of the Config class
const createMockConfig = () => {
    return {
        getProviders: jest.fn().mockReturnValue(['fireworks']),
        getActiveProvider: jest.fn().mockReturnValue('fireworks'),
        getActiveModel: jest.fn().mockReturnValue('accounts/fireworks/models/deepseek-r1'),
        hasProviderApiKey: jest.fn().mockReturnValue(false),
        setProviderApiKey: jest.fn(),
        setActiveProvider: jest.fn(),
        setActiveModel: jest.fn(),
        getModelsForProvider: jest.fn().mockReturnValue(['accounts/fireworks/models/deepseek-r1']),
    } as unknown as Config;
};

describe('ProviderSelection Component', () => {
    let mockConfig: Config;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConfig = createMockConfig();
    });

    it('renders the provider selection form', () => {
        render(<ProviderSelection config={mockConfig} />);

        // Check that the provider dropdown is rendered
        expect(screen.getByText(/Select Provider/i)).toBeInTheDocument();

        // Use a more specific selector for the Fireworks provider button
        const providerButton = screen.getAllByText(/fireworks/i).find(
            element => element.tagName.toLowerCase() === 'button'
        );
        expect(providerButton).toBeInTheDocument();

        // Check that the API key label is rendered
        const apiKeyLabel = screen.getAllByText(/API Key/i).find(
            element => element.tagName.toLowerCase() === 'label'
        );
        expect(apiKeyLabel).toBeInTheDocument();

        // Check that the add API key button is rendered
        const addKeyButton = screen.getByRole('button', { name: /Add API Key/i });
        expect(addKeyButton).toBeInTheDocument();
    });

    it('allows entering an API key', async () => {
        render(<ProviderSelection config={mockConfig} />);

        // Click the Add API Key button
        const addKeyButton = screen.getByRole('button', { name: /Add API Key/i });
        fireEvent.click(addKeyButton);

        // Now the input field should be visible
        const apiKeyInput = screen.getByPlaceholderText(/Enter fireworks API Key/i);
        fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });

        // Click save API key button
        const saveKeyButton = screen.getByRole('button', { name: /Save API Key/i });
        fireEvent.click(saveKeyButton);

        // Check that the API key was saved
        await waitFor(() => {
            expect(mockConfig.setProviderApiKey).toHaveBeenCalledWith('fireworks', 'test-api-key');
        });

        // Check that the provider was initialized
        await waitFor(() => {
            expect(window.electron.ai.initializeProvider).toHaveBeenCalledWith('fireworks', 'test-api-key');
        });
    });

    it('handles API key validation errors', async () => {
        // Mock initialization failure
        (window.electron.ai.initializeProvider as jest.Mock).mockResolvedValueOnce(false);

        render(<ProviderSelection config={mockConfig} />);

        // Click the Add API Key button
        const addKeyButton = screen.getByRole('button', { name: /Add API Key/i });
        fireEvent.click(addKeyButton);

        // Now the input field should be visible
        const apiKeyInput = screen.getByPlaceholderText(/Enter fireworks API Key/i);
        fireEvent.change(apiKeyInput, { target: { value: 'invalid-api-key' } });

        // Click save API key button
        const saveKeyButton = screen.getByRole('button', { name: /Save API Key/i });
        fireEvent.click(saveKeyButton);

        // Check that the API key was saved despite failure
        await waitFor(() => {
            expect(mockConfig.setProviderApiKey).toHaveBeenCalledWith('fireworks', 'invalid-api-key');
        });

        // Check that error message is displayed
        await waitFor(() => {
            expect(screen.getByText(/provider initialization failed/i)).toBeInTheDocument();
        });
    });
}); 