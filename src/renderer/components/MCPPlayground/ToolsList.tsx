import React, { useState } from 'react';

interface ToolsListProps {
    tools: any[];
}

const ToolsList: React.FC<ToolsListProps> = ({ tools }) => {
    const [expandedTool, setExpandedTool] = useState<string | null>(null);

    if (tools.length === 0) {
        return (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No tools available. This MCP server may not support tools or none were found.
            </div>
        );
    }

    const toggleExpand = (toolName: string) => {
        if (expandedTool === toolName) {
            setExpandedTool(null);
        } else {
            setExpandedTool(toolName);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Available Tools</h2>

            <div className="space-y-4">
                {tools.map((tool) => (
                    <div key={tool.name} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                        <div
                            className="p-3 bg-gray-100 dark:bg-gray-700 flex justify-between items-center cursor-pointer"
                            onClick={() => toggleExpand(tool.name)}
                        >
                            <span className="font-medium">{tool.name}</span>
                            <span className="text-gray-500 dark:text-gray-400">{expandedTool === tool.name ? '▲' : '▼'}</span>
                        </div>

                        {expandedTool === tool.name && (
                            <div className="p-4">
                                <div className="mb-3">
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Description:</span>
                                    <p className="mt-1">{tool.description}</p>
                                </div>

                                <div>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Input Schema:</span>
                                    <pre className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md overflow-x-auto text-xs">
                                        {JSON.stringify(tool.inputSchema, null, 2)}
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

export default ToolsList; 