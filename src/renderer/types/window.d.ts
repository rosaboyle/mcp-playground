import { MCPConfig } from '../../shared/mcp-config';

interface ElectronMCPMethods {
    getServers: () => Promise<{ id: string, label: string }[]>;
    connect: (serverId: string, connectionId: string) => Promise<{ success: boolean, error?: string }>;
    disconnect: (connectionId: string) => Promise<{ success: boolean, error?: string }>;
    listTools: (connectionId: string) => Promise<{ success: boolean, data?: any, error?: string, warning?: string }>;
    listResources: (connectionId: string) => Promise<{ success: boolean, data?: any, error?: string, warning?: string }>;
    listPrompts: (connectionId: string) => Promise<{ success: boolean, data?: any, error?: string, warning?: string }>;
    getConfig: () => Promise<{ success: boolean, data?: MCPConfig, error?: string }>;
    saveConfig: (config: MCPConfig) => Promise<{ success: boolean, error?: string }>;
}

interface ElectronUpdaterMethods {
    checkForUpdates: () => Promise<{ success: boolean, message?: string }>;
    downloadUpdate: () => Promise<{ success: boolean, message?: string }>;
    quitAndInstall: () => Promise<{ success: boolean }>;
    onUpdateAvailable: (callback: (info: any) => void) => () => void;
    onUpdateDownloaded: (callback: () => void) => () => void;
    onUpdateError: (callback: (message: string) => void) => () => void;
    onDownloadProgress: (callback: (progressObj: { percent: number }) => void) => () => void;
}

interface ElectronAppMethods {
    getVersion: () => string;
}

declare global {
    interface Window {
        electron: {
            mcp: ElectronMCPMethods;
            updater: ElectronUpdaterMethods;
            app: ElectronAppMethods;
        };
    }
}

export { }; 