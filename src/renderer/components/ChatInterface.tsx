import React, { useState, useEffect, useRef } from 'react';
import { ChatSession } from '../../shared/storage';
import { Message, MessageRole } from '../../shared/types';
import { debugLog } from '../utils/chat';
import MessageList from './chat/MessageList';
import MessageInput, { MessageInputHandle } from './chat/MessageInput';
import ErrorBanner from './chat/ErrorBanner';
import ModelInfoBanner from './chat/ModelInfoBanner';
import StreamManager, { StreamingState } from './chat/StreamManager';
import { trackEvent } from '../utils/posthog';

interface ChatInterfaceProps {
    session: ChatSession;
    config: any;
    settings: any;
    updateSession: (session: ChatSession) => void;
    onSaveMessage?: (message: Message) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
    session,
    config,
    settings,
    updateSession,
    onSaveMessage
}) => {
    debugLog('ChatInterface component rendering');

    // State
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [expandedThinking, setExpandedThinking] = useState<number | null>(null);

    // Reference to the MessageInput component
    const messageInputRef = useRef<MessageInputHandle>(null);

    // Track the actual ChatSession instance
    const sessionRef = useRef<ChatSession>(session);

    // Update the session reference when props change
    useEffect(() => {
        console.log('[DEBUG-SESSION] Session update in ChatInterface:',
            session?.constructor?.name,
            'Has methods:', typeof session?.addMessage === 'function');

        // Only update the ref if we're getting a valid ChatSession with methods
        if (session && typeof session.addMessage === 'function') {
            sessionRef.current = session;
        } else {
            console.error('[DEBUG-SESSION] Received invalid session object without methods');
        }
    }, [session]);

    // Toggle thinking section
    const toggleThinking = (index: number) => {
        setExpandedThinking(expandedThinking === index ? null : index);
    };

    // Handle sending a message
    const handleSendMessage = async (streamProps: StreamingState) => {
        if (input.trim() === '') return;

        try {
            console.log('[DEBUG-SEND] Starting to send message');

            // Create user message
            const userMessage: Message = {
                role: MessageRole.USER,
                content: input.trim(),
                timestamp: new Date().toISOString()
            };

            console.log('[DEBUG-SEND] Created user message');

            // Track chat message sent
            trackEvent('message_sent', {
                message_length: input.trim().length,
                session_id: sessionRef.current?.session_id
            });

            // Verify session is valid and has the addMessage method
            if (sessionRef.current && typeof sessionRef.current.addMessage === 'function') {
                // Add user message directly to the session
                sessionRef.current.addMessage(MessageRole.USER, input.trim());
                console.log(`[DEBUG-SEND] Added message to session directly, new count: ${sessionRef.current.messages.length}`);

                // Update session with the same instance (triggers UI update)
                updateSession(sessionRef.current);
            } else {
                console.error('[DEBUG-SEND] Invalid session or missing addMessage method');
                console.log('[DEBUG-SEND] Session:', sessionRef.current);
                console.log('[DEBUG-SEND] addMessage exists:', sessionRef.current?.addMessage !== undefined);
                setError('Error: Unable to add message to session. Please reload the application.');
                return;
            }

            // Clear input
            setInput('');

            // Reset input height to original size
            if (messageInputRef.current) {
                messageInputRef.current.resetHeight();
            }

            // Format messages for API
            const provider = sessionRef.current.provider || 'fireworks';
            const model = sessionRef.current.model || 'fireworks/deepseek-r1';

            console.log(`[MODEL UI DEBUG] Sending message using provider: ${provider}, model: ${model}`);

            // Get all messages for context (need to map them for API call)
            const messages = sessionRef.current.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            console.log(`[DEBUG-SEND] Prepared ${messages.length} messages for API`);

            // Check if provider is initialized before sending
            try {
                const isInitialized = await window.electron.ai.isProviderInitialized(provider);

                if (!isInitialized) {
                    console.error(`Provider ${provider} is not initialized`);

                    // Check session and method again
                    if (sessionRef.current && typeof sessionRef.current.addMessage === 'function') {
                        // Add error message directly to session
                        sessionRef.current.addMessage(
                            MessageRole.ASSISTANT,
                            `Error: Provider ${provider} is not initialized. Please add an API key in the settings.`
                        );
                        updateSession(sessionRef.current);
                    } else {
                        console.error('[DEBUG-SEND] Session invalid in error handler');
                    }
                    return;
                }

                // Start streaming using the StreamManager
                console.log(`[MODEL UI DEBUG] Starting stream with provider: ${provider}, model: ${model}`);
                await streamProps.startStreaming(
                    provider,
                    model,
                    messages,
                    { temperature: 0.7, max_tokens: 2000 }
                );

            } catch (error) {
                console.error('Error sending message:', error);

                // Check session and method again
                if (sessionRef.current && typeof sessionRef.current.addMessage === 'function') {
                    // Add error message directly to session
                    sessionRef.current.addMessage(
                        MessageRole.ASSISTANT,
                        `Error: ${error instanceof Error ? error.message : String(error)}`
                    );
                    updateSession(sessionRef.current);
                } else {
                    console.error('[DEBUG-SEND] Session invalid in error handler');
                }
            }
        } catch (error) {
            console.error('[DEBUG-SEND] Error in handleSendMessage:', error);
        }
    };

    // Mount/unmount effect
    useEffect(() => {
        debugLog('ChatInterface mounted');
        return () => {
            debugLog('ChatInterface unmounted');
        };
    }, []);

    return (
        <StreamManager session={session} updateSession={updateSession}>
            {(streamProps) => (
                <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                    {/* Error display */}
                    <ErrorBanner error={error} setError={setError} />

                    {/* Model information notice */}
                    <ModelInfoBanner />

                    {/* Messages area */}
                    <MessageList
                        messages={session.messages}
                        isStreaming={streamProps.isStreaming}
                        streamingContent={streamProps.streamingContent}
                        expandedThinking={expandedThinking}
                        settings={settings}
                        toggleThinking={toggleThinking}
                        onCancelStream={streamProps.handleCancelStream}
                    />

                    {/* Input area */}
                    <MessageInput
                        input={input}
                        setInput={setInput}
                        isStreaming={streamProps.isStreaming}
                        onSend={() => handleSendMessage(streamProps)}
                        onCancelStream={streamProps.handleCancelStream}
                        session={session}
                        ref={messageInputRef}
                    />
                </div>
            )}
        </StreamManager>
    );
};

// Log when component is mounted
ChatInterface.displayName = 'ChatInterface';

export default ChatInterface; 