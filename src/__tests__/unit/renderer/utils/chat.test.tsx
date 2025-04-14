import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { debugLog, copyToClipboard, formatMessage } from '../../../../renderer/utils/chat';

// Mock react-markdown
jest.mock('react-markdown', () => {
    return function MockReactMarkdown(props: any) {
        // To make it easier to test, we'll just preserve the original content
        return <div data-testid="markdown">{props.children}</div>;
    };
});

// Mock remark-gfm
jest.mock('remark-gfm', () => {
    return jest.fn();
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
    value: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve()),
    },
    configurable: true,
});

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => {
            return store[key] || null;
        }),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value.toString();
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
    configurable: true,
});

// Mock console methods
const originalConsole = { ...console };
const mockConsole = {
    log: jest.fn(),
    error: jest.fn(),
};

describe('Chat Utils', () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Clear localStorage
        localStorageMock.clear();
        // Setup console mocks
        global.console = { ...originalConsole, ...mockConsole };
    });

    afterAll(() => {
        // Restore console
        global.console = originalConsole;
    });

    describe('debugLog', () => {
        it('logs debug messages with the correct prefix', () => {
            debugLog('Test message');
            expect(mockConsole.log).toHaveBeenCalledWith('[CHAT INTERFACE DEBUG] Test message');
        });
    });

    describe('copyToClipboard', () => {
        it('copies text to clipboard', async () => {
            await copyToClipboard('Test text');
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test text');
        });

        it('handles errors when clipboard API fails', async () => {
            // Mock clipboard API to fail
            const mockWriteText = jest.fn().mockRejectedValue(new Error('Clipboard error'));
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: mockWriteText },
                configurable: true,
            });

            await copyToClipboard('Test text');
            expect(mockWriteText).toHaveBeenCalledWith('Test text');
            expect(mockConsole.error).toHaveBeenCalledWith('Failed to copy text: ', expect.any(Error));
        });
    });

    describe('formatMessage', () => {
        it('renders markdown content', () => {
            const { container } = render(<div>{formatMessage('Test content')}</div>);
            expect(screen.getByTestId('markdown')).toHaveTextContent('Test content');
        });

        it('removes thinking tags from content', () => {
            const { container } = render(
                <div>{formatMessage('Start <think>Thinking process</think> End')}</div>
            );
            // The regex pattern removes the thinking tag but doesn't add spaces, so we should get 'Start End'
            expect(screen.getByTestId('markdown')).toHaveTextContent('Start End');
        });

        it('handles case where message is only thinking', () => {
            const { container } = render(
                <div>{formatMessage('<think>Only thinking</think>', 'Only thinking')}</div>
            );
            expect(container).toHaveTextContent('[Thinking only, no visible output]');
        });

        it('correctly trims whitespace after removing thinking tags', () => {
            const { container } = render(
                <div>
                    {formatMessage(`
            Start
            <think>
              Thinking line 1
              Thinking line 2
            </think>
            End
          `)}
                </div>
            );
            // The expected output will have whitespace, but the exact format can vary
            expect(screen.getByTestId('markdown')).toHaveTextContent(/Start[\s\n]+End/);
        });
    });

    describe('CodeBlock', () => {
        // Since CodeBlock is a private component in the module, we'll test it indirectly
        // through formatMessage with code blocks in the content

        it('renders code blocks with the correct styling in test environment', () => {
            const codeContent = '```js\nconst x = 1;\n```';
            const { container } = render(<div>{formatMessage(codeContent)}</div>);

            // In test environment, we should get the content as-is
            expect(screen.getByTestId('markdown')).toHaveTextContent('```js');
            expect(screen.getByTestId('markdown')).toHaveTextContent('const x = 1;');
        });

        it('respects user theme preferences from localStorage', () => {
            // Set dark theme in localStorage
            localStorageMock.setItem('userSettings', JSON.stringify({ theme: 'dark' }));

            const codeContent = '```js\nconst x = 1;\n```';
            const { container } = render(<div>{formatMessage(codeContent)}</div>);

            // We should still get the markdown in test environment
            expect(screen.getByTestId('markdown')).toHaveTextContent('```js');
            expect(screen.getByTestId('markdown')).toHaveTextContent('const x = 1;');
        });

        it('handles localStorage errors gracefully', () => {
            // Make localStorage.getItem throw an error
            localStorageMock.getItem = jest.fn().mockImplementation(() => {
                throw new Error('localStorage error');
            });

            const codeContent = '```js\nconst x = 1;\n```';
            // This should not throw an error
            const { container } = render(<div>{formatMessage(codeContent)}</div>);

            expect(screen.getByTestId('markdown')).toHaveTextContent('```js');
            expect(screen.getByTestId('markdown')).toHaveTextContent('const x = 1;');
        });
    });
}); 