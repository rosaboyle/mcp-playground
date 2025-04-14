import React from 'react';
import MCPClient from './MCPClient';

interface MCPServer {
    id: string;
    label: string;
}

interface MCPServerListProps {
    servers: MCPServer[];
    connectedServers: {
        [serverId: string]: {
            client: MCPClient;
            tools: any[];
            resources: any[];
            prompts: any[];
        }
    };
    onConnect: (serverId: string, client: MCPClient) => void;
    onDisconnect: (serverId: string) => void;
    onListResources: (serverId: string) => void;
    onListPrompts: (serverId: string) => void;
}

const MCPServerList: React.FC<MCPServerListProps> = ({
    servers,
    connectedServers,
    onConnect,
    onDisconnect,
    onListResources,
    onListPrompts
}) => {
    const handleServerToggle = async (server: MCPServer) => {
        if (connectedServers[server.id]) {
            // Disconnect - this should only happen when explicitly toggled by the user
            const client = connectedServers[server.id].client;
            console.log(`Explicitly disconnecting from server ${server.id}`);
            await client.cleanup();
            onDisconnect(server.id);
        } else {
            // Connect
            try {
                const client = new MCPClient(server.id);
                await client.connect();
                onConnect(server.id, client);
            } catch (error) {
                console.error(`Failed to connect to server ${server.id}:`, error);
            }
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th scope="col" className="px-6 py-3">Server Name</th>
                        <th scope="col" className="px-6 py-3">Status</th>
                        <th scope="col" className="px-6 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {servers.map((server) => (
                        <tr
                            key={server.id}
                            className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                {server.label}
                            </td>
                            <td className="px-6 py-4">
                                {connectedServers[server.id] ? (
                                    <span className="text-green-500">Connected</span>
                                ) : (
                                    <span className="text-gray-500">Disconnected</span>
                                )}
                            </td>
                            <td className="px-6 py-4 space-x-2">
                                <label className="inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={!!connectedServers[server.id]}
                                        onChange={() => handleServerToggle(server)}
                                    />
                                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                                {connectedServers[server.id] && (
                                    <>
                                        <button
                                            onClick={() => onListResources(server.id)}
                                            className="text-blue-500 hover:text-blue-600"
                                        >
                                            Resources
                                        </button>
                                        <button
                                            onClick={() => onListPrompts(server.id)}
                                            className="text-blue-500 hover:text-blue-600"
                                        >
                                            Prompts
                                        </button>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MCPServerList; 