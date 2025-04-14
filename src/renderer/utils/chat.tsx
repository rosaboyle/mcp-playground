import { MessageRole } from '../../shared/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import React, { ReactNode } from 'react';

// Debug logging
export const debugLog = (message: string) => {
    console.log(`[CHAT INTERFACE DEBUG] ${message}`);
};

// Helper function to copy text to clipboard
export const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(err => {
        console.error('Failed to copy text: ', err);
    });
};

// Create a custom Code component for React-Markdown that includes syntax highlighting
const CodeBlock = (props: any) => {
    const { className, children } = props;
    const match = /language-(\w+)/.exec(className || '');
    const lang = match && match[1] ? match[1] : '';

    // Check for application theme settings in localStorage if available
    let isDarkMode = false;
    try {
        // Try to get the user's theme preference from localStorage
        const userSettings = localStorage.getItem('userSettings');
        if (userSettings) {
            const settings = JSON.parse(userSettings);
            isDarkMode = settings.theme === 'dark';
        } else {
            // Fall back to system theme if user settings are not available
            isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
    } catch (e) {
        // Fall back to system theme if there's an error
        isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // If we're in a test environment or there's no match, just return a simple code block
    if (process.env.NODE_ENV === 'test' || !match) {
        return (
            <code className={`${className} font-mono text-sm px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded`}>
                {children}
            </code>
        );
    }

    // Only import and use SyntaxHighlighter in production/development environments
    try {
        // Dynamic import for react-syntax-highlighter components
        const SyntaxHighlighter = require('react-syntax-highlighter').Prism;
        const { vscDarkPlus, vs } = require('react-syntax-highlighter/dist/cjs/styles/prism');

        const theme = isDarkMode ? vscDarkPlus : vs;

        return (
            <div className="code-block-wrapper my-4 border rounded-md overflow-hidden shadow-lg">
                <div className="code-block-header bg-gray-200 dark:bg-gray-700 px-4 py-2 flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                        {lang}
                    </span>
                    <button
                        onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        Copy
                    </button>
                </div>
                <SyntaxHighlighter
                    language={lang}
                    style={theme}
                    customStyle={{
                        margin: 0,
                        padding: '1rem',
                        fontSize: '0.875rem'
                    }}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            </div>
        );
    } catch (error) {
        // Fallback for any errors with syntax highlighting
        return (
            <code className={`${className} font-mono text-sm px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded`}>
                {children}
            </code>
        );
    }
};

// Format message content with thinking section removed
export const formatMessage = (content: string, thinking?: string) => {
    // Check if the content has thinking tags
    const regex = /<think>([\s\S]*?)<\/think>/i;
    const cleanContent = content.replace(regex, '').trim();

    // If the message is just thinking with no actual content
    if (cleanContent === '' && thinking) {
        return <div className="text-gray-500 italic">[Thinking only, no visible output]</div>;
    }

    // Use markdown renderer with custom components
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose dark:prose-invert prose-sm max-w-none"
            components={{
                code: CodeBlock
            }}
        >
            {cleanContent}
        </ReactMarkdown>
    );
}; 