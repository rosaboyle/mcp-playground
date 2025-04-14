import React from 'react';
import { render, act } from '@testing-library/react';
import StreamManager from '../../../../../renderer/components/chat/StreamManager';
import { MessageRole } from '../../../../../shared/types';

// Mock the electron window API
const mockStreamChatCompletion = jest.fn();
const mockCancelStream = jest.fn();
const mockIsProviderInitialized = jest.fn();

window.electron = {
    ai: {
        streamChatCompletion: mockStreamChatCompletion,
        cancelStream: mockCancelStream,
        isProviderInitialized: mockIsProviderInitialized,
        onStreamResponse: jest.fn().mockReturnValue(jest.fn()),
        onStreamError: jest.fn().mockReturnValue(jest.fn()),
        onStreamEnd: jest.fn().mockReturnValue(jest.fn()),
        removeStreamListeners: jest.fn()
    }
} as any;

// Mock trackEvent
jest.mock('../../../../../renderer/utils/posthog', () => ({
    trackEvent: jest.fn()
}));

describe('StreamManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStreamChatCompletion.mockResolvedValue('test-stream-id');
        mockCancelStream.mockResolvedValue(undefined);
    });

    it('renders children with streaming state props', () => {
        const childrenFn = jest.fn().mockReturnValue(<div>Test content</div>);
        const mockSession = {
            session_id: 'test-session',
            messages: [],
            addMessage: jest.fn(),
            provider: 'fireworks',
            model: 'test-model'
        };
        const updateSession = jest.fn();

        render(
            <StreamManager session={mockSession} updateSession={updateSession}>
                {childrenFn}
            </StreamManager>
        );

        expect(childrenFn).toHaveBeenCalledWith(expect.objectContaining({
            isStreaming: false,
            streamingContent: '',
            currentStreamId: null,
            handleCancelStream: expect.any(Function),
            streamingContentRef: expect.any(Object),
            startStreaming: expect.any(Function)
        }));
    });

    it('updates session reference when props change', () => {
        const childrenFn = jest.fn().mockReturnValue(<div>Test content</div>);
        const initialSession = {
            session_id: 'test-session-1',
            messages: [],
            addMessage: jest.fn(),
            provider: 'fireworks',
            model: 'test-model'
        };
        const updateSession = jest.fn();

        const { rerender } = render(
            <StreamManager session={initialSession} updateSession={updateSession}>
                {childrenFn}
            </StreamManager>
        );

        const newSession = {
            session_id: 'test-session-2',
            messages: [],
            addMessage: jest.fn(),
            provider: 'fireworks',
            model: 'test-model'
        };

        rerender(
            <StreamManager session={newSession} updateSession={updateSession}>
                {childrenFn}
            </StreamManager>
        );

        expect(childrenFn).toHaveBeenCalledTimes(2);
    });

    it('starts streaming when startStreaming is called', async () => {
        const childrenFn = jest.fn().mockImplementation(({ startStreaming }) => {
            return (
                <button onClick={() => startStreaming('test-provider', 'test-model', [])}>
                    Start Streaming
                </button>
            );
        });

        const mockSession = {
            session_id: 'test-session',
            messages: [],
            addMessage: jest.fn(),
            provider: 'fireworks',
            model: 'test-model'
        };

        const { getByText } = render(
            <StreamManager session={mockSession} updateSession={jest.fn()}>
                {childrenFn}
            </StreamManager>
        );

        await act(async () => {
            getByText('Start Streaming').click();
        });

        expect(mockStreamChatCompletion).toHaveBeenCalledWith(
            'test-provider',
            'test-model',
            [],
            {}
        );
    });

    it('handles cancel stream', async () => {
        let handleCancelStream: () => Promise<void>;

        const childrenFn = jest.fn().mockImplementation(props => {
            handleCancelStream = props.handleCancelStream;
            return <div>Test content</div>;
        });

        const mockSession = {
            session_id: 'test-session',
            messages: [],
            addMessage: jest.fn(),
            provider: 'fireworks',
            model: 'test-model'
        };

        render(
            <StreamManager session={mockSession} updateSession={jest.fn()}>
                {childrenFn}
            </StreamManager>
        );

        // Set currentStreamId manually through the component's state
        await act(async () => {
            // @ts-ignore - we're accessing the implementation details for testing
            childrenFn.mock.calls[0][0].startStreaming('test-provider', 'test-model', []);
        });

        await act(async () => {
            // @ts-ignore - handleCancelStream is assigned in the mockImplementation
            await handleCancelStream();
        });

        expect(mockCancelStream).toHaveBeenCalled();
    });

    it('cleans up streams on unmount', async () => {
        const childrenFn = jest.fn().mockImplementation(({ startStreaming }) => {
            return (
                <button onClick={() => startStreaming('test-provider', 'test-model', [])}>
                    Start Streaming
                </button>
            );
        });

        const mockSession = {
            session_id: 'test-session',
            messages: [],
            addMessage: jest.fn(),
            provider: 'fireworks',
            model: 'test-model'
        };

        const { getByText, unmount } = render(
            <StreamManager session={mockSession} updateSession={jest.fn()}>
                {childrenFn}
            </StreamManager>
        );

        await act(async () => {
            getByText('Start Streaming').click();
        });

        mockCancelStream.mockClear();

        unmount();

        expect(mockCancelStream).toHaveBeenCalled();
    });
}); 