import React, { useState, useEffect } from 'react';
import { MCPConfig } from '../../../shared/mcp-config';

interface MCPConfigEditorProps {
    onClose: () => void;
    onConfigSaved: () => void;
}

const MCPConfigEditor: React.FC<MCPConfigEditorProps> = ({ onClose, onConfigSaved }) => {
    const [configJson, setConfigJson] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);

    // Load configuration on mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                setIsLoading(true);
                const result = await window.electron.mcp.getConfig();

                if (result.success && result.data) {
                    setConfigJson(JSON.stringify(result.data, null, 2));
                } else {
                    throw new Error(result.error || 'Failed to load MCP configuration');
                }
            } catch (error) {
                console.error('Error loading MCP configuration:', error);
                setValidationErrors([`Failed to load configuration: ${(error as Error).message}`]);
            } finally {
                setIsLoading(false);
            }
        };

        loadConfig();
    }, []);

    const validateJson = (jsonStr: string): boolean => {
        try {
            const errors: string[] = [];
            const config = JSON.parse(jsonStr);

            // Validate basic structure
            if (!config.mcpServers || typeof config.mcpServers !== 'object') {
                errors.push('Invalid configuration: mcpServers must be an object');
                setValidationErrors(errors);
                return false;
            }

            // Validate each server configuration
            Object.entries(config.mcpServers).forEach(([serverName, serverConfig]: [string, any]) => {
                // Validate command
                if (!serverConfig.command || typeof serverConfig.command !== 'string') {
                    errors.push(`Server ${serverName} is missing a valid command`);
                }

                // Validate args (optional, but must be an array if present)
                if (serverConfig.args && !Array.isArray(serverConfig.args)) {
                    errors.push(`Server ${serverName} args must be an array`);
                }

                // Validate env (optional, must be an object if present)
                if (serverConfig.env && (typeof serverConfig.env !== 'object' || Array.isArray(serverConfig.env))) {
                    errors.push(`Server ${serverName} env must be an object if provided`);
                }
            });

            if (errors.length > 0) {
                setValidationErrors(errors);
                return false;
            }

            setValidationErrors([]);
            return true;
        } catch (error) {
            setValidationErrors([`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`]);
            return false;
        }
    };

    // Handle JSON change
    const handleJsonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newJson = event.target.value;
        setConfigJson(newJson);
        validateJson(newJson);
    };

    // Save configuration
    const handleSave = async () => {
        try {
            setIsSaving(true);
            setSaveSuccess(null);

            // Validate JSON
            if (!validateJson(configJson)) {
                return;
            }

            // Parse JSON
            const config = JSON.parse(configJson) as MCPConfig;

            // Save configuration
            const result = await window.electron.mcp.saveConfig(config);

            if (result.success) {
                setSaveSuccess(true);
                onConfigSaved();
            } else {
                throw new Error(result.error || 'Failed to save configuration');
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            setSaveSuccess(false);
            setValidationErrors([`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`]);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-[800px] max-w-[90vw] max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">MCP Server Configuration</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                        <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-auto">
                    <p className="mb-4 text-gray-700 dark:text-gray-300">
                        Edit the MCP server configuration below. The configuration must follow this schema:
                    </p>

                    <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded text-sm mb-4 overflow-auto text-gray-700 dark:text-gray-300">
                        {`{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": {  // Optional
        "ENV_VAR1": "value1",
        "ENV_VAR2": "value2"
      }
    }
  }
}`}</pre>

                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500"></div>
                        </div>
                    ) : (
                        <textarea
                            className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            value={configJson}
                            onChange={handleJsonChange}
                            spellCheck={false}
                        />
                    )}

                    {validationErrors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded">
                            <p className="font-semibold mb-1">Validation Errors:</p>
                            <ul className="list-disc pl-5">
                                {validationErrors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-4 flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || validationErrors.length > 0}
                            className={`px-4 py-2 rounded-md ${isSaving || validationErrors.length > 0
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-primary-500 text-white hover:bg-primary-600'
                                }`}
                        >
                            {isSaving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MCPConfigEditor; 