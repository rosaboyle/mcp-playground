interface ElectronAPI {
    ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
        on(channel: string, listener: (event: any, ...args: any[]) => void): () => void;
        removeAllListeners(channel: string): void;
    };
    fs: {
        readFile(filePath: string, options: any): string | Buffer;
        writeFile(filePath: string, data: any, options: any): void;
        readdir(dirPath: string): string[];
        mkdir(dirPath: string, options: any): void;
        exists(path: string): boolean;
        stat(path: string): any;
        unlink(path: string): void;
    };
    path: {
        join(...args: string[]): string;
        resolve(...args: string[]): string;
        basename(filePath: string, ext?: string): string;
        dirname(filePath: string): string;
        extname(filePath: string): string;
    };
    os: {
        homedir(): string;
        platform(): string;
        release(): string;
    };
    ai: {
        initializeProvider(provider: string, apiKey: string): Promise<boolean>;
        isProviderInitialized(provider: string): Promise<boolean>;
        listModels(provider: string): Promise<string[]>;
        chatCompletion(provider: string, model: string, messages: any[], options?: any): Promise<any>;
        streamChatCompletion(provider: string, model: string, messages: any[], options?: any): Promise<string>;
        cancelStream(streamId: string): Promise<boolean>;
        onStreamResponse(callback: (data: StreamResponseData) => void): () => void;
        onStreamError(callback: (data: StreamErrorData) => void): () => void;
        onStreamEnd(callback: (data: StreamEndData) => void): () => void;
        removeStreamListeners(): void;
    };
}

interface StreamResponseData {
    streamId: string;
    chunk: {
        content: string;
        done: boolean;
    };
}

interface StreamErrorData {
    streamId: string;
    error: string;
}

interface StreamEndData {
    streamId: string;
}

declare global {
    interface Window {
        electron: ElectronAPI;
    }
}

export { };
