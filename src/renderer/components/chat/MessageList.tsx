import React, { useRef, useEffect } from 'react';
import { Message } from '../../../shared/types';
import MessageItem from './MessageItem';
import StreamingMessage from './StreamingMessage';
import { debugLog } from '../../utils/chat';

interface MessageListProps {
    messages: Message[];
    isStreaming: boolean;
    streamingContent: string;
    expandedThinking: number | null;
    settings: any;
    toggleThinking: (index: number) => void;
    onCancelStream: () => void;
}

const MessageList: React.FC<MessageListProps> = ({
    messages,
    isStreaming,
    streamingContent,
    expandedThinking,
    settings,
    toggleThinking,
    onCancelStream
}) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Debug info
    console.log('[DEBUG-RENDER] Rendering messages:', {
        messageCount: messages.length,
        isStreaming,
        streamContentLength: streamingContent?.length || 0
    });

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        debugLog('Scrolling to bottom of messages');
        // Check if the ref exists and has scrollIntoView (wouldn't exist in test environment)
        if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, streamingContent, isStreaming]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Message history */}
            {messages.map((message, index) => (
                <MessageItem
                    key={`${message.timestamp}-${index}`}
                    message={message}
                    index={index}
                    expandedThinking={expandedThinking}
                    settings={settings}
                    toggleThinking={toggleThinking}
                />
            ))}

            {/* Streaming message */}
            {isStreaming && streamingContent && (
                <StreamingMessage
                    content={streamingContent}
                />
            )}

            {/* Processing indicator */}
            {isStreaming && !streamingContent && (
                <div className="flex items-center justify-center my-4">
                    <div className="bg-gray-800 rounded-lg p-3 flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-white">Processing...</span>
                    </div>
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList; 