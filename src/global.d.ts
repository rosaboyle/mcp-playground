interface ElectronAPI {
    ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => () => void;
        removeAllListeners: (channel: string) => void;
    };
    fs: {
        readFile: (path: string, options: any) => any;
        writeFile: (path: string, data: any, options: any) => void;
        readdir: (path: string) => string[];
        mkdir: (path: string, options: any) => void;
        exists: (path: string) => boolean;
        stat: (path: string) => any;
        unlink: (path: string) => void;
    };
    path: {
        join: (...paths: string[]) => string;
        resolve: (...paths: string[]) => string;
        basename: (path: string, ext?: string) => string;
        dirname: (path: string) => string;
        extname: (path: string) => string;
    };
    os: {
        homedir: () => string;
        platform: () => string;
        release: () => string;
    };
    ai: {
        initializeProvider: (provider: string, apiKey: string) => Promise<boolean>;
        isProviderInitialized: (provider: string) => Promise<boolean>;
        listModels: (provider: string) => Promise<string[]>;
        chatCompletion: (provider: string, model: string, messages: any[], options?: any) => Promise<any>;
        streamChatCompletion: (provider: string, model: string, messages: any[], options?: any) => Promise<string>;
        cancelStream: (streamId: string) => Promise<boolean>;
        onStreamResponse: (callback: (data: StreamResponseData) => void) => () => void;
        onStreamError: (callback: (data: StreamErrorData) => void) => () => void;
        onStreamEnd: (callback: (data: StreamEndData) => void) => () => void;
        removeStreamListeners: () => void;
    };
    mcp: {
        getServers: () => Promise<{ id: string; label: string }[]>;
        connect: (serverId: string, connectionId: string) => Promise<{ success: boolean; error?: string }>;
        disconnect: (connectionId: string) => Promise<{ success: boolean; error?: string }>;
        getActiveConnections: () => Promise<{ success: boolean; connections?: Record<string, string[]>; error?: string }>;
        listTools: (connectionId: string) => Promise<{ success: boolean; data?: any; error?: string; warning?: string }>;
        listResources: (connectionId: string) => Promise<{ success: boolean; data?: any; error?: string; warning?: string }>;
        listPrompts: (connectionId: string) => Promise<{ success: boolean; data?: any; error?: string; warning?: string }>;
        getConfig: () => Promise<{ success: boolean; data?: any; error?: string }>;
        saveConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
    };
}

interface StreamResponseData {
    streamId: string;
    chunk: {
        content: string;
        id?: string;
        role?: string;
        [key: string]: any;
    };
}

interface StreamErrorData {
    streamId: string;
    error: string;
}

interface StreamEndData {
    streamId: string;
    finalContent?: string;
}

interface Window {
    electron?: ElectronAPI;
    __posthog_full_bundle?: any;
} 