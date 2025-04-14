import React from 'react';
import { formatMessage } from '../../utils/chat';

interface StreamingMessageProps {
    content: string;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({ content }) => {
    console.log('[DEBUG-RENDER] Rendering streaming content:', content.substring(0, 30) + '...');

    return (
        <div className="flex justify-start">
            <div className="max-w-[85%] p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                {formatMessage(content)}

                <div className="mt-2 flex items-center">
                    <div className="animate-pulse mr-2 text-gray-400">●</div>
                    <span className="text-xs text-gray-500">Generating response...</span>
                </div>
            </div>
        </div>
    );
};

export default StreamingMessage; 