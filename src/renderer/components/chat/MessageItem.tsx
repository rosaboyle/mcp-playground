import React, { useState } from 'react';
import { Message } from '../../../shared/types';
import { FiChevronDown, FiChevronUp, FiCopy } from 'react-icons/fi';
import { formatMessage, copyToClipboard } from '../../utils/chat';
import { MessageRole } from '../../../shared/types';

interface MessageItemProps {
    message: Message;
    index: number;
    expandedThinking: number | null;
    settings: any;
    toggleThinking: (index: number) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
    message,
    index,
    expandedThinking,
    settings,
    toggleThinking
}) => {
    return (
        <div
            key={`${message.timestamp}-${index}`}
            className={`flex ${message.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[85%] p-3 rounded-lg ${message.role === MessageRole.USER
                    ? 'bg-primary-500 text-white'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                    }`}
            >
                {/* Message content */}
                <div className="relative">
                    {formatMessage(message.content, message.thinking)}

                    {/* Copy button */}
                    <button
                        className="absolute top-0 right-0 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 opacity-0 hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(message.content)}
                        title="Copy message"
                    >
                        <FiCopy size={16} />
                    </button>
                </div>

                {/* Thinking section */}
                {message.role === MessageRole.ASSISTANT && message.thinking && settings.show_thinking && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <button
                            className="flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            onClick={() => toggleThinking(index)}
                        >
                            {expandedThinking === index ? (
                                <>
                                    <FiChevronUp className="mr-1" /> Hide AI Thinking
                                </>
                            ) : (
                                <>
                                    <FiChevronDown className="mr-1" /> Show AI Thinking
                                </>
                            )}
                        </button>

                        {expandedThinking === index && (
                            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                                {settings.use_markdown ? (
                                    <pre className="whitespace-pre-wrap font-mono text-xs">
                                        {message.thinking}
                                    </pre>
                                ) : (
                                    <div className="whitespace-pre-wrap">{message.thinking}</div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageItem; 