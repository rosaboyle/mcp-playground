import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock dependencies first
jest.mock('electron', () => ({
    contextBridge: {
        exposeInMainWorld: jest.fn()
    },
    ipcRenderer: {
        invoke: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        send: jest.fn(),
        removeListener: jest.fn()
    }
}));

jest.mock('fs', () => ({
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    readdirSync: jest.fn(),
    mkdirSync: jest.fn(),
    existsSync: jest.fn(),
    statSync: jest.fn(),
    unlinkSync: jest.fn()
}));

jest.mock('os', () => ({
    homedir: jest.fn(),
    platform: jest.fn(),
    release: jest.fn()
}));

jest.mock('path', () => ({
    join: jest.fn(),
    resolve: jest.fn(),
    basename: jest.fn(),
    dirname: jest.fn(),
    extname: jest.fn()
}));

// Mock the logger
jest.mock('../../../main/logger', () => {
    const mockLogger = {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        time: jest.fn(),
        timeEnd: jest.fn()
    };
    return {
        createLogger: jest.fn().mockReturnValue(mockLogger)
    };
});

// Now import after mocks
import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Skip these tests in the Jest environment since they require the actual Electron runtime
describe.skip('Preload Script', () => {
    it('should be tested in an Electron environment', () => {
        // This test is just a placeholder to indicate these tests are skipped
        expect(true).toBe(true);
    });
});

describe('Preload Script', () => {
    // Original process.env values
    const originalProcessEnv = process.env;
    const originalProcessArgv = process.argv;

    // Setup before all tests
    beforeAll(() => {
        // Restore console.log for useful debugging during tests
        console.log = jest.fn();
    });

    // Setup before each test
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset process.env and argv
        process.env = { ...originalProcessEnv };
        process.argv = [...originalProcessArgv];

        // Mock the exposeInMainWorld to capture the API
        (contextBridge.exposeInMainWorld as jest.Mock).mockImplementation((key, api) => {
            return { key, api };
        });
    });

    // Restore after all tests
    afterAll(() => {
        process.env = originalProcessEnv;
        process.argv = originalProcessArgv;
    });

    it('exposes API to the renderer process', () => {
        // Import the preload script which will call exposeInMainWorld
        jest.isolateModules(() => {
            require('../../../main/preload');
        });

        // Verify that contextBridge.exposeInMainWorld was called
        expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
            'electron',
            expect.objectContaining({
                ipcRenderer: expect.any(Object),
                fs: expect.any(Object),
                path: expect.any(Object),
                os: expect.any(Object),
                ai: expect.any(Object)
            })
        );
    });

    describe('Exposed IPC Renderer API', () => {
        let api: any;

        beforeEach(() => {
            // Reset mocks
            jest.clearAllMocks();

            // Mock exposeInMainWorld to capture the API object
            (contextBridge.exposeInMainWorld as jest.Mock).mockImplementation((key, apiObj) => {
                if (key === 'electron') {
                    api = apiObj;
                }
                return { key, api: apiObj };
            });

            // Import the preload script in isolation
            jest.isolateModules(() => {
                require('../../../main/preload');
            });
        });

        it('handles the is-dev channel directly in preload', async () => {
            // Test with NODE_ENV set to development
            process.env.NODE_ENV = 'development';

            const result = await api.ipcRenderer.invoke('is-dev');

            expect(result).toBe(true);
            // Should not forward to actual ipcRenderer.invoke
            expect(ipcRenderer.invoke).not.toHaveBeenCalledWith('is-dev');
        });

        it('handles the is-dev channel with --dev flag', async () => {
            // Reset NODE_ENV but add --dev flag
            process.env.NODE_ENV = 'production';
            process.argv.push('--dev');

            const result = await api.ipcRenderer.invoke('is-dev');

            expect(result).toBe(true);
        });

        it('forwards other invoke calls to ipcRenderer', async () => {
            (ipcRenderer.invoke as jest.Mock).mockResolvedValue('test-result');

            const result = await api.ipcRenderer.invoke('some-channel', 'arg1', 'arg2');

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('some-channel', 'arg1', 'arg2');
            expect(result).toBe('test-result');
        });

        it('provides on method that returns an unsubscribe function', () => {
            const mockListener = jest.fn();

            // Setup the mock to simulate how ipcRenderer.on works
            (ipcRenderer.on as jest.Mock).mockImplementation((channel, callback) => {
                callback('event-object', 'arg1', 'arg2');
                return callback; // Not really used but making sure it's returned
            });

            const unsubscribe = api.ipcRenderer.on('test-channel', mockListener);

            // Check that the listener was registered
            expect(ipcRenderer.on).toHaveBeenCalledWith('test-channel', expect.any(Function));

            // Check that our listener was called with the right arguments
            expect(mockListener).toHaveBeenCalledWith('event-object', 'arg1', 'arg2');

            // Now call the unsubscribe function
            unsubscribe();

            // Check that removeListener was called correctly
            expect(ipcRenderer.removeListener).toHaveBeenCalledWith('test-channel', expect.any(Function));
        });

        it('provides removeAllListeners method', () => {
            api.ipcRenderer.removeAllListeners('test-channel');

            expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('test-channel');
        });
    });

    describe('Exposed Filesystem API', () => {
        let api: any;

        beforeEach(() => {
            // Reset mocks
            jest.clearAllMocks();

            // Mock exposeInMainWorld to capture the API object
            (contextBridge.exposeInMainWorld as jest.Mock).mockImplementation((key, apiObj) => {
                if (key === 'electron') {
                    api = apiObj;
                }
                return { key, api: apiObj };
            });

            // Import the preload script in isolation
            jest.isolateModules(() => {
                require('../../../main/preload');
            });
        });

        it('provides readFile method', () => {
            (fs.readFileSync as jest.Mock).mockReturnValue('file contents');

            const result = api.fs.readFile('/path/to/file', 'utf8');

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file', 'utf8');
            expect(result).toBe('file contents');
        });

        it('provides writeFile method', () => {
            api.fs.writeFile('/path/to/file', 'data', 'utf8');

            expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/file', 'data', 'utf8');
        });

        it('provides readdir method', () => {
            (fs.readdirSync as jest.Mock).mockReturnValue(['file1.txt', 'file2.txt']);

            const result = api.fs.readdir('/path/to/dir');

            expect(fs.readdirSync).toHaveBeenCalledWith('/path/to/dir');
            expect(result).toEqual(['file1.txt', 'file2.txt']);
        });

        it('provides mkdir method', () => {
            api.fs.mkdir('/path/to/dir', { recursive: true });

            expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to/dir', { recursive: true });
        });

        it('provides exists method', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            const result = api.fs.exists('/path/to/file');

            expect(fs.existsSync).toHaveBeenCalledWith('/path/to/file');
            expect(result).toBe(true);
        });

        it('provides stat method', () => {
            const mockStats = { size: 1024, isDirectory: () => false };
            (fs.statSync as jest.Mock).mockReturnValue(mockStats);

            const result = api.fs.stat('/path/to/file');

            expect(fs.statSync).toHaveBeenCalledWith('/path/to/file');
            expect(result).toBe(mockStats);
        });

        it('provides unlink method', () => {
            api.fs.unlink('/path/to/file');

            expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/file');
        });
    });

    describe('Exposed Path API', () => {
        let api: any;

        beforeEach(() => {
            // Reset mocks
            jest.clearAllMocks();

            // Mock exposeInMainWorld to capture the API object
            (contextBridge.exposeInMainWorld as jest.Mock).mockImplementation((key, apiObj) => {
                if (key === 'electron') {
                    api = apiObj;
                }
                return { key, api: apiObj };
            });

            // Import the preload script in isolation
            jest.isolateModules(() => {
                require('../../../main/preload');
            });
        });

        it('provides join method', () => {
            (path.join as jest.Mock).mockReturnValue('/path/to/file.txt');

            const result = api.path.join('/path', 'to', 'file.txt');

            expect(path.join).toHaveBeenCalledWith('/path', 'to', 'file.txt');
            expect(result).toBe('/path/to/file.txt');
        });

        it('provides resolve method', () => {
            (path.resolve as jest.Mock).mockReturnValue('/absolute/path/to/file.txt');

            const result = api.path.resolve('path', 'to', 'file.txt');

            expect(path.resolve).toHaveBeenCalledWith('path', 'to', 'file.txt');
            expect(result).toBe('/absolute/path/to/file.txt');
        });

        it('provides basename method', () => {
            (path.basename as jest.Mock).mockReturnValue('file.txt');

            const result = api.path.basename('/path/to/file.txt');

            expect(path.basename).toHaveBeenCalledWith('/path/to/file.txt', undefined);
            expect(result).toBe('file.txt');
        });

        it('provides dirname method', () => {
            (path.dirname as jest.Mock).mockReturnValue('/path/to');

            const result = api.path.dirname('/path/to/file.txt');

            expect(path.dirname).toHaveBeenCalledWith('/path/to/file.txt');
            expect(result).toBe('/path/to');
        });

        it('provides extname method', () => {
            (path.extname as jest.Mock).mockReturnValue('.txt');

            const result = api.path.extname('/path/to/file.txt');

            expect(path.extname).toHaveBeenCalledWith('/path/to/file.txt');
            expect(result).toBe('.txt');
        });
    });

    describe('Exposed OS API', () => {
        let api: any;

        beforeEach(() => {
            // Reset mocks
            jest.clearAllMocks();

            // Mock exposeInMainWorld to capture the API object
            (contextBridge.exposeInMainWorld as jest.Mock).mockImplementation((key, apiObj) => {
                if (key === 'electron') {
                    api = apiObj;
                }
                return { key, api: apiObj };
            });

            // Import the preload script in isolation
            jest.isolateModules(() => {
                require('../../../main/preload');
            });
        });

        it('provides homedir method', () => {
            (os.homedir as jest.Mock).mockReturnValue('/home/user');

            const result = api.os.homedir();

            expect(os.homedir).toHaveBeenCalled();
            expect(result).toBe('/home/user');
        });

        it('provides platform method', () => {
            (os.platform as jest.Mock).mockReturnValue('darwin');

            const result = api.os.platform();

            expect(os.platform).toHaveBeenCalled();
            expect(result).toBe('darwin');
        });

        it('provides release method', () => {
            (os.release as jest.Mock).mockReturnValue('20.0.0');

            const result = api.os.release();

            expect(os.release).toHaveBeenCalled();
            expect(result).toBe('20.0.0');
        });
    });

    describe('Exposed AI API', () => {
        let api: any;

        beforeEach(() => {
            // Reset mocks
            jest.clearAllMocks();

            // Mock exposeInMainWorld to capture the API object
            (contextBridge.exposeInMainWorld as jest.Mock).mockImplementation((key, apiObj) => {
                if (key === 'electron') {
                    api = apiObj;
                }
                return { key, api: apiObj };
            });

            // Import the preload script in isolation
            jest.isolateModules(() => {
                require('../../../main/preload');
            });

            // Setup ipcRenderer.invoke mock
            (ipcRenderer.invoke as jest.Mock).mockResolvedValue('test-result');
        });

        it('provides initializeProvider method', async () => {
            const result = await api.ai.initializeProvider('openai', 'api-key');

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('ai:initialize-provider', 'openai', 'api-key');
            expect(result).toBe('test-result');
        });

        it('provides isProviderInitialized method', async () => {
            const result = await api.ai.isProviderInitialized('openai');

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('ai:is-provider-initialized', 'openai');
            expect(result).toBe('test-result');
        });

        it('provides listModels method', async () => {
            const result = await api.ai.listModels('openai');

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('ai:list-models', 'openai');
            expect(result).toBe('test-result');
        });

        it('provides chatCompletion method', async () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const options = { temperature: 0.7 };

            const result = await api.ai.chatCompletion('openai', 'gpt-3.5-turbo', messages, options);

            expect(ipcRenderer.invoke).toHaveBeenCalledWith(
                'ai:chat-completion',
                'openai',
                'gpt-3.5-turbo',
                messages,
                options
            );
            expect(result).toBe('test-result');
        });

        it('provides streamChatCompletion method', async () => {
            const messages = [{ role: 'user', content: 'Hello' }];
            const options = { temperature: 0.7 };

            const result = await api.ai.streamChatCompletion('openai', 'gpt-3.5-turbo', messages, options);

            expect(ipcRenderer.invoke).toHaveBeenCalledWith(
                'ai:stream-chat-completion',
                'openai',
                'gpt-3.5-turbo',
                messages,
                options
            );
            expect(result).toBe('test-result');
        });

        it('provides cancelStream method', async () => {
            const result = await api.ai.cancelStream('stream-id');

            expect(ipcRenderer.invoke).toHaveBeenCalledWith('ai:cancel-stream', 'stream-id');
            expect(result).toBe('test-result');
        });

        it('provides onStreamResponse method', () => {
            const callback = jest.fn();

            // Setup mock for on method
            (ipcRenderer.on as jest.Mock).mockImplementation((channel, handler) => {
                if (channel === 'ai:stream-response') {
                    handler('event', { streamId: 'stream-id', chunk: { content: 'hello' } });
                }
                return handler;
            });

            api.ai.onStreamResponse(callback);

            // Should register for stream events
            expect(ipcRenderer.send).toHaveBeenCalledWith('ai:register-stream-listeners');

            // Should set up event listener
            expect(ipcRenderer.on).toHaveBeenCalledWith('ai:stream-response', expect.any(Function));

            // Callback should be called with the data
            expect(callback).toHaveBeenCalledWith({
                streamId: 'stream-id',
                chunk: { content: 'hello' }
            });
        });

        it('provides onStreamError method', () => {
            const callback = jest.fn();

            // Setup mock for on method
            (ipcRenderer.on as jest.Mock).mockImplementation((channel, handler) => {
                if (channel === 'ai:stream-error') {
                    handler('event', { streamId: 'stream-id', error: 'Test error' });
                }
                return handler;
            });

            api.ai.onStreamError(callback);

            // Should set up event listener
            expect(ipcRenderer.on).toHaveBeenCalledWith('ai:stream-error', expect.any(Function));

            // Callback should be called with the data
            expect(callback).toHaveBeenCalledWith({
                streamId: 'stream-id',
                error: 'Test error'
            });
        });

        it('provides onStreamEnd method', () => {
            const callback = jest.fn();

            // Setup mock for on method
            (ipcRenderer.on as jest.Mock).mockImplementation((channel, handler) => {
                if (channel === 'ai:stream-end') {
                    handler('event', { streamId: 'stream-id' });
                }
                return handler;
            });

            api.ai.onStreamEnd(callback);

            // Should set up event listener
            expect(ipcRenderer.on).toHaveBeenCalledWith('ai:stream-end', expect.any(Function));

            // Callback should be called with the data
            expect(callback).toHaveBeenCalledWith({ streamId: 'stream-id' });
        });

        it('provides removeStreamListeners method', () => {
            api.ai.removeStreamListeners();

            // Should send event to main process
            expect(ipcRenderer.send).toHaveBeenCalledWith('ai:remove-stream-listeners');

            // Should remove all event listeners
            expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('ai:stream-response');
            expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('ai:stream-error');
            expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith('ai:stream-end');
        });
    });
}); 