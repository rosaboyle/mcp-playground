import React, { useState, useEffect, useRef } from 'react';
import { Config } from '../../../shared/config';
import { MCPConfig } from '../../../shared/mcp-config';
import MCPClient from './MCPClient';
import MCPServerList from './MCPServerList';
import ToolsList from './ToolsList';
import ResourcesList from './ResourcesList';
import PromptsList from './PromptsList';
import MCPConfigEditor from './MCPConfigEditor';
import AddMCPServerDialog from './AddMCPServerDialog';
import ConfirmationDialog from './ConfirmationDialog';

interface MCPPlaygroundProps {
    config: Config;
}

type MCPView = 'tools' | 'resources' | 'prompts';

const MCPPlayground: React.FC<MCPPlaygroundProps> = ({ config }) => {
    const [activeView, setActiveView] = useState<MCPView>('tools');
    const [showConfigEditor, setShowConfigEditor] = useState(false);
    const [showAddServerDialog, setShowAddServerDialog] = useState(false);
    const [currentConfig, setCurrentConfig] = useState<MCPConfig>({ mcpServers: {} });
    // Ref to track if component is mounted
    const isMounted = useRef(true);

    // New state for multiple server connections
    const [connectedServers, setConnectedServers] = useState<{
        [serverId: string]: {
            client: MCPClient,
            tools: any[],
            resources: any[],
            prompts: any[]
        }
    }>({});

    // Load current configuration on mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const result = await window.electron.mcp.getConfig();
                if (result.success && result.data) {
                    setCurrentConfig(result.data);
                }
            } catch (error) {
                console.error('Failed to load MCP configuration:', error);
            }
        };

        loadConfig();

        // Set mounted flag
        isMounted.current = true;

        // Cleanup function called on unmount
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Retrieve active connections when component mounts
    useEffect(() => {
        const retrieveActiveConnections = async () => {
            try {
                console.log('Retrieving active MCP connections from main process');
                const result = await window.electron.mcp.getActiveConnections();

                if (result.success && result.connections) {
                    console.log('Retrieved active connections:', result.connections);

                    // For each active serverId, create a new client and fetch its tools
                    const activeConnectionsByServer = result.connections;
                    const updatedConnections: typeof connectedServers = {};

                    for (const serverId of Object.keys(activeConnectionsByServer)) {
                        const connectionIds = activeConnectionsByServer[serverId];
                        if (connectionIds && connectionIds.length > 0) {
                            const connectionId = connectionIds[0]; // Use the first active connection

                            try {
                                // Create a new client that reuses the existing connection
                                const client = new MCPClient(serverId, connectionId);
                                // Don't reconnect, just use existing connection

                                // Get tools for this connection
                                const toolsList = await client.listTools();

                                updatedConnections[serverId] = {
                                    client,
                                    tools: toolsList?.tools || [],
                                    resources: [],
                                    prompts: []
                                };
                            } catch (error) {
                                console.error(`Error restoring connection for server ${serverId}:`, error);
                            }
                        }
                    }

                    if (Object.keys(updatedConnections).length > 0) {
                        setConnectedServers(updatedConnections);
                    }
                }
            } catch (error) {
                console.error('Failed to retrieve active connections:', error);
            }
        };

        retrieveActiveConnections();
    }, []);

    const handleServerConnect = async (serverId: string, client: MCPClient) => {
        try {
            // List tools automatically after connection
            const toolsList = await client.listTools();

            setConnectedServers(prev => ({
                ...prev,
                [serverId]: {
                    client,
                    tools: toolsList?.tools || [],
                    resources: [],
                    prompts: []
                }
            }));
        } catch (error) {
            console.error(`Failed to list tools for server ${serverId}:`, error);
        }
    };

    const handleServerDisconnect = (serverId: string) => {
        const newConnectedServers = { ...connectedServers };
        delete newConnectedServers[serverId];
        setConnectedServers(newConnectedServers);
    };

    const handleListResources = async (serverId: string) => {
        if (!connectedServers[serverId]) return;

        try {
            const client = connectedServers[serverId].client;
            const resourcesList = await client.listResources();

            setConnectedServers(prev => ({
                ...prev,
                [serverId]: {
                    ...prev[serverId],
                    resources: resourcesList?.resources || []
                }
            }));

            setActiveView('resources');
        } catch (error) {
            console.error('Error listing resources:', error);
        }
    };

    const handleListPrompts = async (serverId: string) => {
        if (!connectedServers[serverId]) return;

        try {
            const client = connectedServers[serverId].client;
            const promptsList = await client.listPrompts();

            setConnectedServers(prev => ({
                ...prev,
                [serverId]: {
                    ...prev[serverId],
                    prompts: promptsList?.prompts || []
                }
            }));

            setActiveView('prompts');
        } catch (error) {
            console.error('Error listing prompts:', error);
        }
    };

    const handleOpenConfigEditor = () => {
        setShowConfigEditor(true);
    };

    const handleConfigSaved = async () => {
        try {
            const result = await window.electron.mcp.getConfig();
            if (result.success && result.data) {
                setCurrentConfig(result.data);
            }
            setShowConfigEditor(false);
        } catch (error) {
            console.error('Failed to reload configuration:', error);
        }
    };

    const handleAddServer = async (newConfig: MCPConfig) => {
        try {
            console.log('Saving new configuration:', newConfig);

            // Save the new configuration
            const result = await window.electron.mcp.saveConfig(newConfig);

            if (result.success) {
                console.log('Configuration saved successfully');

                // Update local state with new configuration
                setCurrentConfig(newConfig);

                // Close the dialog
                setShowAddServerDialog(false);

                // Reload the configuration to ensure we have the latest
                const reloadResult = await window.electron.mcp.getConfig();
                if (reloadResult.success && reloadResult.data) {
                    console.log('Reloaded configuration:', reloadResult.data);
                    setCurrentConfig(reloadResult.data);
                }
            } else {
                console.error('Failed to save configuration:', result.error);
            }
        } catch (error) {
            console.error('Error saving server configuration:', error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">MCP Playground</h1>

                <div className="flex space-x-3">
                    <button
                        onClick={handleOpenConfigEditor}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                        Edit Configuration
                    </button>
                    <button
                        onClick={() => setShowAddServerDialog(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Add Server
                    </button>
                </div>
            </div>

            {/* Server List */}
            <div className="mb-6">
                <MCPServerList
                    servers={Object.keys(currentConfig.mcpServers).map(id => ({
                        id,
                        label: id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                    }))}
                    connectedServers={connectedServers}
                    onConnect={handleServerConnect}
                    onDisconnect={handleServerDisconnect}
                    onListResources={handleListResources}
                    onListPrompts={handleListPrompts}
                />
            </div>

            {/* Content Area */}
            {Object.entries(connectedServers).length > 0 ? (
                <>
                    {/* View Selector */}
                    <div className="flex space-x-4 mb-4">
                        <button
                            onClick={() => setActiveView('tools')}
                            className={`px-4 py-2 rounded ${activeView === 'tools'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            Tools
                        </button>
                        <button
                            onClick={() => setActiveView('resources')}
                            className={`px-4 py-2 rounded ${activeView === 'resources'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            Resources
                        </button>
                        <button
                            onClick={() => setActiveView('prompts')}
                            className={`px-4 py-2 rounded ${activeView === 'prompts'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            Prompts
                        </button>
                    </div>

                    {/* Content Display */}
                    <div className="flex-1 overflow-auto">
                        {activeView === 'tools' && (
                            <div className="space-y-6">
                                {Object.entries(connectedServers).map(([serverId, serverData]) => (
                                    <div key={serverId} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                        <h3 className="text-xl font-semibold mb-4">
                                            Tools for {serverId}
                                        </h3>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800">
                                            <ToolsList tools={serverData.tools} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeView === 'resources' && (
                            <div className="space-y-6">
                                {Object.entries(connectedServers).map(([serverId, serverData]) => (
                                    <div key={serverId} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                        <h3 className="text-xl font-semibold mb-4">
                                            Resources for {serverId}
                                        </h3>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800">
                                            <ResourcesList resources={serverData.resources} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeView === 'prompts' && (
                            <div className="space-y-6">
                                {Object.entries(connectedServers).map(([serverId, serverData]) => (
                                    <div key={serverId} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                        <h3 className="text-xl font-semibold mb-4">
                                            Prompts for {serverId}
                                        </h3>
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800">
                                            <PromptsList prompts={serverData.prompts} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 dark:text-gray-400">
                        Connect to an MCP server to view its tools, resources, and prompts.
                    </p>
                </div>
            )}

            {showConfigEditor && (
                <MCPConfigEditor
                    onClose={() => setShowConfigEditor(false)}
                    onConfigSaved={handleConfigSaved}
                />
            )}

            {showAddServerDialog && (
                <AddMCPServerDialog
                    existingConfig={currentConfig}
                    onClose={() => setShowAddServerDialog(false)}
                    onSave={handleAddServer}
                />
            )}
        </div>
    );
};

export default MCPPlayground; 