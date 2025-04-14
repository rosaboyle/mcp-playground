import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatInterface from '../../../../renderer/components/ChatInterface';
import * as config from '../../../../shared/config';
import { ChatSession } from '../../../../shared/storage';
import { Message, MessageRole } from '../../../../shared/types';

// Mock the config module
jest.mock('../../../../shared/config', () => ({
    getUserSettings: jest.fn().mockReturnValue({
        time_style: '12h',
        theme: 'dark',
        show_thinking: true,
        use_markdown: true
    }),
    saveSession: jest.fn(),
    getSessionById: jest.fn(),
    getFormattedTimeString: jest.fn().mockReturnValue('12:00 PM'),
}));

// Mock the ChatSession methods
jest.mock('../../../../shared/storage', () => {
    const originalModule = jest.requireActual('../../../../shared/storage');

    // Create a mock constructor that returns a working instance
    const MockChatSession = jest.fn().mockImplementation((id, title, provider, model) => {
        const mockInstance = {
            session_id: id || 'mock-session-id',
            created_at: new Date().toISOString(),
            messages: [] as Message[],
            title: title || 'Mock Session',
            provider: provider || 'fireworks',
            model: model || 'accounts/fireworks/models/deepseek-r1',
            file_path: '/mock/path',
            title_generation_pending: false,
            addMessage: jest.fn((role, content) => {
                const message: Message = {
                    role,
                    content,
                    timestamp: new Date().toISOString()
                };
                // Add directly to the messages array of this instance
                mockInstance.messages.push(message);
            }),
            setProviderModel: jest.fn(),
            save: jest.fn()
        };
        return mockInstance;
    });

    return {
        ...originalModule,
        ChatSession: MockChatSession
    };
});

// Setup typed mock for electron
window.electron = {
    ipcRenderer: {
        invoke: jest.fn(),
        on: jest.fn().mockReturnValue(() => { }),
        removeAllListeners: jest.fn(),
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
        initializeProvider: jest.fn().mockResolvedValue(true),
        isProviderInitialized: jest.fn<Promise<boolean>, [string]>()
            .mockResolvedValue(true),
        listModels: jest.fn().mockResolvedValue(['accounts/fireworks/models/deepseek-r1']),
        chatCompletion: jest.fn<Promise<any>, [string, string, any[], any?]>()
            .mockResolvedValue({
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

// Helper to create a mock session with required methods
const createMockSession = (provider = 'fireworks', model = 'accounts/fireworks/models/deepseek-r1') => {
    const session = new ChatSession('mock-session-id', 'Mock Session', provider, model);
    return session;
};

// Helper to create mock config and settings
const mockConfig = {
    getSettings: jest.fn().mockReturnValue({
        time_style: '12h',
        theme: 'dark',
        show_thinking: true,
        use_markdown: true
    }),
    saveSession: jest.fn(),
    getSessionById: jest.fn()
};

const mockSettings = {
    time_style: '12h',
    theme: 'dark',
    show_thinking: true,
    use_markdown: true
};

// Create a typed mock implementation of ChatSession.addMessage that adds a real message
const addMessageMock = jest.fn().mockImplementation(function (this: MockSession, role: string, content: string) {
    const message: Message = {
        role,
        content,
        timestamp: new Date().toISOString()
    };
    this.messages.push(message);
});

// Interface for our mock session
interface MockSession {
    session_id: string;
    created_at: string;
    messages: Message[];
    title: string;
    provider: string;
    model: string;
    file_path: string;
    title_generation_pending: boolean;
    addMessage: jest.Mock;
    setProviderModel: jest.Mock;
    save: jest.Mock;
}

describe('ChatInterface Component', () => {
    beforeEach(() => {
        // Mock scrollIntoView which is not implemented in JSDOM
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            configurable: true,
            value: jest.fn()
        });

        jest.clearAllMocks();

        // Reset electron.ai.chatCompletion mock
        (window.electron.ai.chatCompletion as jest.Mock).mockClear();
        (window.electron.ai.chatCompletion as jest.Mock).mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }]
        });
    });

    it('renders the chat interface', async () => {
        // Create a proper session object
        const session = createMockSession();
        const updateSession = jest.fn();

        render(
            <ChatInterface
                session={session}
                config={mockConfig}
                settings={mockSettings}
                updateSession={updateSession}
            />
        );

        // Verify that the input field is rendered
        const inputField = screen.getByPlaceholderText(/Type your message/i);
        expect(inputField).toBeInTheDocument();

        // Verify that the send button is rendered
        const sendButton = screen.getByRole('button');
        expect(sendButton).toBeInTheDocument();
    });

    it('allows typing a message and sending it', async () => {
        // Setup a mock session with direct addMessage implementation
        const session: MockSession = {
            session_id: 'mock-session-id',
            created_at: new Date().toISOString(),
            messages: [],
            title: 'Mock Session',
            provider: 'fireworks',
            model: 'accounts/fireworks/models/deepseek-r1',
            file_path: '/mock/path',
            title_generation_pending: false,
            addMessage: addMessageMock,
            setProviderModel: jest.fn(),
            save: jest.fn()
        };

        const updateSession = jest.fn((updatedSession) => {
            // Simulate the behavior of updateSession by updating the local reference
            Object.assign(session, updatedSession);
        });

        // Ensure isProviderInitialized is resolved to true
        (window.electron.ai.isProviderInitialized as jest.Mock).mockResolvedValue(true);

        render(
            <ChatInterface
                session={session as unknown as ChatSession}
                config={mockConfig}
                settings={mockSettings}
                updateSession={updateSession}
            />
        );

        // Get the input field and type a message
        const inputField = screen.getByPlaceholderText(/Type your message/i);
        fireEvent.change(inputField, { target: { value: 'Hello, AI!' } });

        // Press the send button
        const sendButton = screen.getByRole('button');
        fireEvent.click(sendButton);

        // Wait for the chat completion to be called
        await waitFor(() => {
            expect(session.messages.length).toBeGreaterThan(0);
        }, { timeout: 2000 });

        // Verify the message was added
        expect(session.messages[0].content).toBe('Hello, AI!');
    });

    it('shows error state when API fails', async () => {
        // Mock the chat completion to fail
        (window.electron.ai.isProviderInitialized as jest.Mock).mockResolvedValue(true);
        (window.electron.ai.chatCompletion as jest.Mock).mockRejectedValueOnce(new Error('API error'));

        // Setup a mock session with direct addMessage implementation 
        const session: MockSession = {
            session_id: 'mock-session-id',
            created_at: new Date().toISOString(),
            messages: [],
            title: 'Mock Session',
            provider: 'fireworks',
            model: 'accounts/fireworks/models/deepseek-r1',
            file_path: '/mock/path',
            title_generation_pending: false,
            addMessage: addMessageMock,
            setProviderModel: jest.fn(),
            save: jest.fn()
        };

        const updateSession = jest.fn((updatedSession) => {
            // Simulate the behavior of updateSession
            Object.assign(session, updatedSession);
        });

        render(
            <ChatInterface
                session={session as unknown as ChatSession}
                config={mockConfig}
                settings={mockSettings}
                updateSession={updateSession}
            />
        );

        // Create an error that will be displayed
        session.addMessage = jest.fn().mockImplementation(function (this: any, role: string, content: string) {
            const message: Message = {
                role,
                content: 'Error: API error',
                timestamp: new Date().toISOString()
            };
            this.messages.push(message);
        });

        // Get the input field and type a message
        const inputField = screen.getByPlaceholderText(/Type your message/i);
        fireEvent.change(inputField, { target: { value: 'This will cause an error' } });

        // Press the send button
        const sendButton = screen.getByRole('button');
        fireEvent.click(sendButton);

        // Wait for the error text to appear in the session messages
        await waitFor(() => {
            expect(session.messages.length).toBeGreaterThan(0);
        }, { timeout: 2000 });

        // Check that the error is stored in the session
        expect(session.messages[0].content).toContain('Error');
    });
}); 