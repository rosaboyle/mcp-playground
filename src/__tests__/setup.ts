import '@testing-library/jest-dom';

// Mock the Electron API
// Ensure window is defined before adding electron to it
if (typeof window === 'undefined') {
    // @ts-ignore
    global.window = {};
}

// Mock the Electron API directly on window
window.electron = {
    ipcRenderer: {
        invoke: jest.fn(),
        on: jest.fn().mockReturnValue(() => { }),
        removeAllListeners: jest.fn(),
    },
    fs: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        readdir: jest.fn(),
        mkdir: jest.fn(),
        exists: jest.fn(),
        stat: jest.fn(),
        unlink: jest.fn(),
    },
    path: {
        join: jest.fn((...args) => args.join('/')),
        resolve: jest.fn((...args) => args.join('/')),
        basename: jest.fn((path: string, ext?: string) => {
            const parts = path.split('/');
            const filename = parts[parts.length - 1] || '';
            if (ext && filename.endsWith(ext)) {
                return filename.slice(0, -ext.length);
            }
            return filename;
        }),
        dirname: jest.fn((path: string) => path.split('/').slice(0, -1).join('/')),
        extname: jest.fn((path: string) => {
            const parts = path.split('.');
            return parts.length > 1 ? `.${parts.pop()}` : '';
        }),
    },
    os: {
        homedir: jest.fn(() => '/home/user'),
        platform: jest.fn(() => 'darwin'),
        release: jest.fn(() => '1.0.0'),
    },
    ai: {
        initializeProvider: jest.fn().mockResolvedValue(true),
        isProviderInitialized: jest.fn().mockResolvedValue(true),
        listModels: jest.fn().mockResolvedValue(['fireworks/deepseek-r1']),
        chatCompletion: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock response' } }]
        }),
        streamChatCompletion: jest.fn().mockResolvedValue('mock-stream-id'),
        cancelStream: jest.fn().mockResolvedValue(true),
        onStreamResponse: jest.fn().mockReturnValue(() => { }),
        onStreamError: jest.fn().mockReturnValue(() => { }),
        onStreamEnd: jest.fn().mockReturnValue(() => { }),
        removeStreamListeners: jest.fn(),
    },
    // Add updater mock
    updater: {
        checkForUpdates: jest.fn().mockResolvedValue({ success: true }),
        downloadUpdate: jest.fn().mockResolvedValue({ success: true }),
        quitAndInstall: jest.fn().mockResolvedValue({ success: true }),
        onUpdateAvailable: jest.fn().mockReturnValue(() => { }),
        onUpdateDownloaded: jest.fn().mockReturnValue(() => { }),
        onUpdateError: jest.fn().mockReturnValue(() => { }),
        onDownloadProgress: jest.fn().mockReturnValue(() => { }),
    },
    // Add app mock
    app: {
        getVersion: jest.fn().mockReturnValue('0.1.2-test'),
    },
};

// Also make it available globally for compatibility
// @ts-ignore - add electron property to global to make it accessible in both ways
global.electron = window.electron;

// Helper to reset all mock implementations
beforeEach(() => {
    jest.clearAllMocks();
});

// Mock console methods to keep test output clean
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
}; 