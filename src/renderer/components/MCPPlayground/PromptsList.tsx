import React, { useState } from 'react';

interface PromptsListProps {
    prompts: any[];
}

const PromptsList: React.FC<PromptsListProps> = ({ prompts }) => {
    const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

    if (prompts.length === 0) {
        return (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No prompts available. This MCP server may not support prompts or none were found.
            </div>
        );
    }

    const toggleExpand = (promptId: string) => {
        if (expandedPrompt === promptId) {
            setExpandedPrompt(null);
        } else {
            setExpandedPrompt(promptId);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Available Prompts</h2>

            <div className="space-y-4">
                {prompts.map((prompt) => (
                    <div key={prompt.id || prompt.name} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                        <div
                            className="p-3 bg-gray-100 dark:bg-gray-700 flex justify-between items-center cursor-pointer"
                            onClick={() => toggleExpand(prompt.id || prompt.name)}
                        >
                            <span className="font-medium">{prompt.name || prompt.id}</span>
                            <span className="text-gray-500 dark:text-gray-400">
                                {expandedPrompt === (prompt.id || prompt.name) ? '▲' : '▼'}
                            </span>
                        </div>

                        {expandedPrompt === (prompt.id || prompt.name) && (
                            <div className="p-4">
                                {prompt.description && (
                                    <div className="mb-3">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Description:</span>
                                        <p className="mt-1">{prompt.description}</p>
                                    </div>
                                )}

                                <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Prompt Details:</span>
                                    <pre className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md overflow-x-auto text-xs">
                                        {JSON.stringify(prompt, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PromptsList; 