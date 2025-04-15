import React, { useState } from 'react';
import { MCPConfig, MCPServerConfig } from '../../../shared/mcp-config';

interface AddMCPServerDialogProps {
    existingConfig: MCPConfig;
    onClose: () => void;
    onSave: (newConfig: MCPConfig) => void;
}

const AddMCPServerDialog: React.FC<AddMCPServerDialogProps> = ({ existingConfig, onClose, onSave }) => {
    const [configJson, setConfigJson] = useState<string>('');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const validateServerConfig = (config: any): config is MCPConfig => {
        const errors: string[] = [];

        try {
            // Check if it's a valid JSON object
            if (!config || typeof config !== 'object') {
                errors.push('Configuration must be a JSON object');
                return false;
            }

            // Check mcpServers property
            if (!config.mcpServers || typeof config.mcpServers !== 'object') {
                errors.push('Configuration must have a "mcpServers" object property');
                return false;
            }

            // Check each server configuration
            for (const [serverId, serverConfig] of Object.entries<any>(config.mcpServers)) {
                // Check server ID
                if (!serverId || typeof serverId !== 'string') {
                    errors.push(`Server ID must be a non-empty string: "${serverId}"`);
                    continue;
                }

                // Check if server ID already exists
                if (existingConfig.mcpServers[serverId]) {
                    errors.push(`Server ID "${serverId}" already exists in the configuration`);
                    continue;
                }

                // Check server config structure
                if (!serverConfig || typeof serverConfig !== 'object') {
                    errors.push(`Server configuration for "${serverId}" must be an object`);
                    continue;
                }

                // Check required properties
                if (!serverConfig.command || typeof serverConfig.command !== 'string') {
                    errors.push(`Server "${serverId}" must have a "command" string property`);
                }

                if (!Array.isArray(serverConfig.args)) {
                    errors.push(`Server "${serverId}" must have an "args" array property`);
                }

                // Check env if it exists
                if (serverConfig.env && typeof serverConfig.env !== 'object') {
                    errors.push(`Server "${serverId}" env must be an object if provided`);
                }
            }

            setValidationErrors(errors);
            return errors.length === 0;
        } catch (error) {
            setValidationErrors([`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`]);
            return false;
        }
    };

    const handleSave = async () => {
        try {
            console.log('Parsing new server configuration...');
            const newConfig = JSON.parse(configJson);

            console.log('Validating new server configuration...');
            if (!validateServerConfig(newConfig)) {
                console.error('Validation failed:', validationErrors);
                return;
            }

            console.log('Creating merged configuration...');
            console.log('Existing config:', existingConfig);
            console.log('New config:', newConfig);

            // Create merged configuration
            const mergedConfig: MCPConfig = {
                mcpServers: {
                    ...existingConfig.mcpServers,
                    ...newConfig.mcpServers
                }
            };

            console.log('Final merged configuration:', mergedConfig);
            onSave(mergedConfig);
        } catch (error) {
            console.error('Error in handleSave:', error);
            setValidationErrors([`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="p-6 flex-1 overflow-auto">
                    <h2 className="text-2xl font-bold mb-4">Add MCP Server</h2>

                    <div className="mb-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Enter the server configuration in JSON format. Example:
                        </p>
                        <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded text-sm mb-4">
                            {`{
    "mcpServers": {
        "my-server": {
            "command": "docker",
            "args": ["run", "-i", "--rm", "my-image"],
            "env": {  // Optional
                "API_KEY": "your-api-key"
            }
        }
    }
}`}
                        </pre>
                    </div>

                    <textarea
                        value={configJson}
                        onChange={(e) => setConfigJson(e.target.value)}
                        className="w-full h-64 p-3 border rounded font-mono text-sm dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Enter server configuration..."
                    />

                    {validationErrors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded">
                            <h3 className="font-bold text-red-700 dark:text-red-300 mb-2">Validation Errors:</h3>
                            <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400">
                                {validationErrors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={validationErrors.length > 0}
                        className={`px-4 py-2 rounded ${validationErrors.length > 0
                            ? 'bg-blue-300 dark:bg-blue-800 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-400'
                            } text-white`}
                    >
                        Add Server
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddMCPServerDialog; 