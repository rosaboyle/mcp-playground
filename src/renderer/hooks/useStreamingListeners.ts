import { useEffect, useRef } from 'react';
import { debugLog } from '../utils/chat';
import { ChatSession } from '../../shared/storage';

interface StreamListenerProps {
    currentStreamId: string | null;
    streamingContent: string;
    setStreamingContent: React.Dispatch<React.SetStateAction<string>>;
    finishStreaming: (success: boolean) => void;
}

export function useStreamingListeners({
    currentStreamId,
    streamingContent,
    setStreamingContent,
    finishStreaming
}: StreamListenerProps) {
    // Track streaming content separately from react state
    const streamingContentRef = useRef(streamingContent);

    useEffect(() => {
        streamingContentRef.current = streamingContent;
    }, [streamingContent]);

    // Set up event listeners for streaming
    useEffect(() => {
        debugLog('Setting up stream event listeners');
        console.log('[DEBUG-STREAM] Setting up stream listeners, currentStreamId:', currentStreamId);

        // Skip if no stream ID is set
        if (!currentStreamId) {
            return () => { }; // Return empty cleanup function when no streamId is set
        }

        // Create a local variable to track cumulative content
        let cumulativeContent = streamingContentRef.current || '';

        // Keep track of streaming status to avoid race conditions
        let isCompleted = false;

        // Set up streaming event listeners
        const removeResponseListener = window.electron.ai.onStreamResponse((data: any) => {
            if (data.streamId === currentStreamId && !isCompleted) {
                console.log('[DEBUG-STREAM] Received chunk:', {
                    streamId: data.streamId,
                    chunkLength: data.chunk.content?.length || 0,
                    chunk: data.chunk.content?.substring(0, 20) + '...' || 'empty'
                });

                // Append to our local tracker
                if (data.chunk.content) {
                    cumulativeContent += data.chunk.content;
                    streamingContentRef.current = cumulativeContent;
                }

                // Use a functional update to ensure we're always working with the latest state
                setStreamingContent(prev => {
                    const newContent = prev + (data.chunk.content || '');
                    console.log('[DEBUG-STREAM] Updated streamingContent length:', newContent.length);
                    return newContent;
                });
            }
        });

        const removeErrorListener = window.electron.ai.onStreamError((data: any) => {
            if (data.streamId === currentStreamId && !isCompleted) {
                console.error('[DEBUG-STREAM] Stream error:', data.error);
                isCompleted = true;
                finishStreaming(false);
            }
        });

        const removeEndListener = window.electron.ai.onStreamEnd((data: any) => {
            if (data.streamId === currentStreamId && !isCompleted) {
                console.log('[DEBUG-STREAM] Stream end event received', {
                    streamId: data.streamId,
                    cumulativeContentLength: cumulativeContent.length
                });

                isCompleted = true;

                // Small delay before finalizing to ensure all chunks are processed
                setTimeout(() => {
                    console.log('[DEBUG-STREAM] Finalizing after delay with content length:',
                        cumulativeContent.length);

                    // Force the final streamingContent to match our cumulative tracking
                    if (cumulativeContent.length > 0) {
                        setStreamingContent(cumulativeContent);

                        // Give React a chance to update the state before finalizing
                        setTimeout(() => {
                            console.log('[DEBUG-STREAM] Final content set, calling finishStreaming');
                            finishStreaming(true);
                        }, 100);
                    } else {
                        finishStreaming(true);
                    }
                }, 100);
            }
        });

        // Clean up listeners when component unmounts
        return () => {
            try {
                console.log('[DEBUG-STREAM] Cleaning up stream listeners');

                if (typeof removeResponseListener === 'function') {
                    removeResponseListener();
                }

                if (typeof removeErrorListener === 'function') {
                    removeErrorListener();
                }

                if (typeof removeEndListener === 'function') {
                    removeEndListener();
                }

                window.electron.ai.removeStreamListeners();
            } catch (error) {
                console.error('Error cleaning up stream listeners:', error);
            }
        };
    }, [currentStreamId, finishStreaming, setStreamingContent]);

    return {
        streamingContentRef
    };
} 