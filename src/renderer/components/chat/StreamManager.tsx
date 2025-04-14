import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatSession } from '../../../shared/storage';
import { MessageRole } from '../../../shared/types';
import { useStreamingListeners } from '../../hooks/useStreamingListeners';
import { trackEvent } from '../../utils/posthog';

interface StreamManagerProps {
    session: ChatSession;
    updateSession: (session: ChatSession) => void;
    children: (streamProps: StreamingState) => React.ReactNode;
}

export interface StreamingState {
    isStreaming: boolean;
    streamingContent: string;
    currentStreamId: string | null;
    handleCancelStream: () => Promise<void>;
    streamingContentRef: React.RefObject<string>;
    startStreaming: (
        provider: string,
        model: string,
        messages: { role: string; content: string }[],
        options?: Record<string, any>
    ) => Promise<string>;
}

const StreamManager: React.FC<StreamManagerProps> = ({
    session,
    updateSession,
    children
}) => {
    // Streaming state
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);

    // Track the actual ChatSession instance
    const sessionRef = useRef<ChatSession>(session);

    // Update the session reference when props change
    useEffect(() => {
        console.log('[DEBUG-SESSION] Session update in StreamManager:',
            session?.constructor?.name,
            'Has methods:', typeof session?.addMessage === 'function');

        // Only update the ref if we're getting a valid ChatSession with methods
        if (session && typeof session.addMessage === 'function') {
            sessionRef.current = session;
        } else {
            console.error('[DEBUG-SESSION] Received invalid session object without methods');
        }
    }, [session]);

    // Helper to finish streaming and add message
    const finishStreaming = useCallback((success: boolean) => {
        console.log('[DEBUG-STREAM-END] Starting finishStreaming', {
            success,
            streamId: currentStreamId,
            contentLength: streamingContentRef.current?.length || 0,
            content: streamingContentRef.current?.substring(0, 50) + '...' || 'empty',
            sessionType: sessionRef.current?.constructor?.name
        });

        // Exit early if there's no content - this shouldn't happen on successful completion
        if (!streamingContentRef.current || streamingContentRef.current.trim() === '') {
            console.log('[DEBUG-STREAM-END] No streaming content to save, exiting early');
            setIsStreaming(false);
            setCurrentStreamId(null);
            return;
        }

        // Only process and save message if streaming was successful
        if (success && currentStreamId) {
            try {
                console.log('[DEBUG-STREAM-END] Adding message to chat history');

                // Track successful message reception
                trackEvent('message_received', {
                    response_length: streamingContentRef.current.length,
                    session_id: sessionRef.current?.session_id,
                    time_to_response: Date.now() - new Date(sessionRef.current?.messages[sessionRef.current?.messages.length - 1]?.timestamp || Date.now()).getTime()
                });

                // Verify session is valid and has the addMessage method
                if (sessionRef.current && typeof sessionRef.current.addMessage === 'function') {
                    // Track before message count
                    const beforeMsgCount = sessionRef.current.messages.length;
                    console.log(`[DEBUG-STREAM-END] Session messages before save: ${beforeMsgCount}`);

                    // Add message directly to the session - using the preserved instance from the ref
                    sessionRef.current.addMessage(MessageRole.ASSISTANT, streamingContentRef.current);

                    // Update session - pass the actual instance, not a copy
                    console.log(`[DEBUG-STREAM-END] Session messages after adding: ${sessionRef.current.messages.length}`);
                    updateSession(sessionRef.current);
                } else {
                    console.error('[DEBUG-STREAM-END] Invalid session or missing addMessage method');
                    console.log('[DEBUG-STREAM-END] Session:', sessionRef.current);
                    console.log('[DEBUG-STREAM-END] addMessage exists:', sessionRef.current?.addMessage !== undefined);
                    console.log('[DEBUG-STREAM-END] Session type:', sessionRef.current?.constructor?.name);
                }

                // Reset streaming state after a delay to avoid flickering
                setTimeout(() => {
                    console.log('[DEBUG-STREAM-END] Resetting streaming state after delay');
                    setIsStreaming(false);
                    setStreamingContent('');
                    streamingContentRef.current = '';
                    setCurrentStreamId(null);
                }, 1000);
            } catch (error) {
                console.error('[DEBUG-STREAM-END] Error saving message:', error);
                setIsStreaming(false);
                setStreamingContent('');
                streamingContentRef.current = '';
                setCurrentStreamId(null);
            }
        } else {
            // If unsuccessful or cancelled, just reset the streaming state
            console.log('[DEBUG-STREAM-END] Stream unsuccessful or cancelled, resetting state');
            setIsStreaming(false);
            setStreamingContent('');
            streamingContentRef.current = '';
            setCurrentStreamId(null);
        }
    }, [currentStreamId, updateSession]);

    // Set up streaming listeners
    const { streamingContentRef } = useStreamingListeners({
        currentStreamId,
        streamingContent,
        setStreamingContent,
        finishStreaming
    });

    // Handle cancelling a stream
    const handleCancelStream = async () => {
        if (currentStreamId) {
            try {
                console.log('[DEBUG-CANCEL] Cancelling stream:', currentStreamId);
                await window.electron.ai.cancelStream(currentStreamId);

                // Track stream cancellation event
                trackEvent('stream_cancelled', {
                    partial_content_length: streamingContentRef.current?.length || 0,
                    session_id: sessionRef.current?.session_id
                });

                // Add partial message to chat if there's content
                if (streamingContentRef.current) {
                    console.log('[DEBUG-CANCEL] Adding cancelled message to session');

                    // Check session and method
                    if (sessionRef.current && typeof sessionRef.current.addMessage === 'function') {
                        // Add message directly to session
                        sessionRef.current.addMessage(
                            MessageRole.ASSISTANT,
                            streamingContentRef.current + ' [cancelled]'
                        );
                        updateSession(sessionRef.current);

                        console.log(`[DEBUG-CANCEL] Updated session with cancelled message, new count: ${sessionRef.current.messages.length}`);
                    } else {
                        console.error('[DEBUG-CANCEL] Invalid session or missing addMessage method');
                    }
                }

                // Reset streaming state
                setIsStreaming(false);
                setStreamingContent('');
                streamingContentRef.current = '';
                setCurrentStreamId(null);
            } catch (error) {
                console.error('[DEBUG-CANCEL] Error cancelling stream:', error);
                setIsStreaming(false);
                setStreamingContent('');
                streamingContentRef.current = '';
                setCurrentStreamId(null);
            }
        }
    };

    // Mount/unmount handling
    useEffect(() => {
        // Cancellation for any active streams
        return () => {
            if (currentStreamId) {
                console.log(`Cancelling stream on unmount: ${currentStreamId}`);
                window.electron.ai.cancelStream(currentStreamId).catch(err => {
                    console.error('Error cancelling stream on unmount:', err);
                });
            }
        };
    }, [currentStreamId]);

    // Expose API for starting a stream
    const startStreaming = async (
        provider: string,
        model: string,
        messages: { role: string; content: string }[],
        options: Record<string, any> = {}
    ) => {
        try {
            setIsStreaming(true);
            console.log('[DEBUG-STREAM-START] Set isStreaming to true');
            console.log(`[MODEL DEBUG] StreamManager.startStreaming with provider: ${provider}, model: ${model}`);

            // Call the AI using streaming
            console.log('[DEBUG-STREAM-START] Before calling streamChatCompletion');
            const streamId = await window.electron.ai.streamChatCompletion(
                provider,
                model,
                messages,
                options
            );
            console.log('[DEBUG-STREAM-START] Received streamId:', streamId);
            console.log(`[MODEL DEBUG] StreamManager received streamId: ${streamId} for model: ${model}`);

            // Store the stream ID for managing the stream
            setCurrentStreamId(streamId);
            console.log('[DEBUG-STREAM-START] Set currentStreamId:', streamId);

            return streamId;
        } catch (error) {
            console.error('Error starting stream:', error);
            setIsStreaming(false);
            throw error;
        }
    };

    return (
        <>
            {children({
                isStreaming,
                streamingContent,
                currentStreamId,
                handleCancelStream,
                streamingContentRef,
                startStreaming
            })}
        </>
    );
};

export default StreamManager; 