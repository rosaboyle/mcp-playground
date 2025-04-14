import { renderHook, act } from '@testing-library/react';
import { useStreamingListeners } from '../../../../renderer/hooks/useStreamingListeners';

// Mock the electron window API
const mockOnStreamResponse = jest.fn();
const mockOnStreamError = jest.fn();
const mockOnStreamEnd = jest.fn();
const mockRemoveStreamListeners = jest.fn();

window.electron = {
    ai: {
        onStreamResponse: mockOnStreamResponse,
        onStreamError: mockOnStreamError,
        onStreamEnd: mockOnStreamEnd,
        removeStreamListeners: mockRemoveStreamListeners
    }
} as any;

describe('useStreamingListeners', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Set up mock implementations for the listeners
        mockOnStreamResponse.mockImplementation(callback => {
            // Simulate calling the callback
            callback({
                streamId: 'test-stream-id',
                chunk: { content: 'test content' }
            });
            return jest.fn();
        });

        mockOnStreamError.mockReturnValue(jest.fn());
        mockOnStreamEnd.mockReturnValue(jest.fn());
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should set up stream listeners when currentStreamId is provided', () => {
        const setStreamingContent = jest.fn();
        const finishStreaming = jest.fn();

        renderHook(() => useStreamingListeners({
            currentStreamId: 'test-stream-id',
            streamingContent: '',
            setStreamingContent,
            finishStreaming
        }));

        expect(mockOnStreamResponse).toHaveBeenCalled();
        expect(mockOnStreamError).toHaveBeenCalled();
        expect(mockOnStreamEnd).toHaveBeenCalled();
        expect(setStreamingContent).toHaveBeenCalled();
    });

    it('should not set up listeners when currentStreamId is null', () => {
        const setStreamingContent = jest.fn();
        const finishStreaming = jest.fn();

        renderHook(() => useStreamingListeners({
            currentStreamId: null,
            streamingContent: '',
            setStreamingContent,
            finishStreaming
        }));

        expect(mockOnStreamResponse).not.toHaveBeenCalled();
        expect(mockOnStreamError).not.toHaveBeenCalled();
        expect(mockOnStreamEnd).not.toHaveBeenCalled();
    });

    it('should update streamingContent when receiving a chunk', () => {
        const setStreamingContent = jest.fn();
        const finishStreaming = jest.fn();

        renderHook(() => useStreamingListeners({
            currentStreamId: 'test-stream-id',
            streamingContent: '',
            setStreamingContent,
            finishStreaming
        }));

        expect(setStreamingContent).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should clean up listeners on unmount', () => {
        const setStreamingContent = jest.fn();
        const finishStreaming = jest.fn();

        const { unmount } = renderHook(() => useStreamingListeners({
            currentStreamId: 'test-stream-id',
            streamingContent: '',
            setStreamingContent,
            finishStreaming
        }));

        unmount();
        expect(mockRemoveStreamListeners).toHaveBeenCalled();
    });

    it('should call finishStreaming when stream ends and has content', () => {
        const setStreamingContent = jest.fn();
        const finishStreaming = jest.fn();

        // Mock implementation for stream end
        mockOnStreamEnd.mockImplementation(callback => {
            // Simulate calling the callback
            callback({
                streamId: 'test-stream-id'
            });
            return jest.fn();
        });

        renderHook(() => useStreamingListeners({
            currentStreamId: 'test-stream-id',
            streamingContent: 'Some content',
            setStreamingContent,
            finishStreaming
        }));

        // Fast-forward timers to trigger the setTimeout callbacks
        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(finishStreaming).toHaveBeenCalledWith(true);
    });
}); 