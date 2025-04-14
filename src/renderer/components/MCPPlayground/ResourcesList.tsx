import React, { useState } from 'react';

interface ResourcesListProps {
    resources: any[];
}

const ResourcesList: React.FC<ResourcesListProps> = ({ resources }) => {
    const [expandedResource, setExpandedResource] = useState<string | null>(null);

    if (resources.length === 0) {
        return (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No resources available. This MCP server may not support resources or none were found.
            </div>
        );
    }

    const toggleExpand = (resourceId: string) => {
        if (expandedResource === resourceId) {
            setExpandedResource(null);
        } else {
            setExpandedResource(resourceId);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold mb-4">Available Resources</h2>

            <div className="space-y-4">
                {resources.map((resource) => (
                    <div key={resource.id || resource.name} className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                        <div
                            className="p-3 bg-gray-100 dark:bg-gray-700 flex justify-between items-center cursor-pointer"
                            onClick={() => toggleExpand(resource.id || resource.name)}
                        >
                            <span className="font-medium">{resource.name || resource.id}</span>
                            <span className="text-gray-500 dark:text-gray-400">
                                {expandedResource === (resource.id || resource.name) ? '▲' : '▼'}
                            </span>
                        </div>

                        {expandedResource === (resource.id || resource.name) && (
                            <div className="p-4">
                                <pre className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md overflow-x-auto text-xs">
                                    {JSON.stringify(resource, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ResourcesList; 