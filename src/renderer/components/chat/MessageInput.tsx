import React, { useRef, KeyboardEvent, forwardRef, useImperativeHandle } from 'react';
import { FiSend, FiSquare } from 'react-icons/fi';
import { ChatSession } from '../../../shared/storage';

interface MessageInputProps {
    input: string;
    setInput: (value: string) => void;
    isStreaming: boolean;
    onSend: () => void;
    onCancelStream: () => void;
    session: ChatSession;
}

// Define the methods exposed by the component
export interface MessageInputHandle {
    resetHeight: () => void;
}

const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(({
    input,
    setInput,
    isStreaming,
    onSend,
    onCancelStream,
    session
}, ref) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        resetHeight: () => {
            // Reset the height of the textarea to its default
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
            }
        }
    }));

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);

        // Auto-adjust height based on content
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isStreaming) {
                onSend();
                // No need to reset height here as it will be handled in handleSendMessage
            }
        }
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            {/* Debug session info - will help debugging */}
            <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 text-xs border border-gray-300 dark:border-gray-600 rounded">
                <strong>Debug Info:</strong> Session ID: {session.session_id} |
                Messages: {session.messages.length} |
                Last message timestamp: {session.messages.length > 0 ? new Date(session.messages[session.messages.length - 1]?.timestamp).toLocaleTimeString() : 'none'}
            </div>

            <div className="flex items-end gap-2">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    disabled={isStreaming}
                    rows={1}
                />
                {isStreaming ? (
                    <button
                        onClick={onCancelStream}
                        className="p-2 rounded-md bg-red-500 hover:bg-red-600 text-white"
                        title="Stop generating"
                    >
                        <FiSquare size={20} />
                    </button>
                ) : (
                    <button
                        onClick={onSend}
                        disabled={!input.trim()}
                        className={`p-2 rounded-md ${!input.trim()
                            ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                            : 'bg-primary-500 hover:bg-primary-600 text-white'
                            }`}
                        title="Send message"
                    >
                        <FiSend size={20} />
                    </button>
                )}
            </div>
        </div>
    );
});

export default MessageInput; 