import { Config } from '../../../shared/config';

// Mock isRenderer to force renderer process context
jest.mock('../../../shared/config', () => {
    const originalModule = jest.requireActual('../../../shared/config');
    return {
        ...originalModule,
        isRenderer: jest.fn().mockReturnValue(true)
    };
});

describe('Config', () => {
    // Store original window for cleanup
    const originalWindow = global.window;

    beforeEach(() => {
        // Create a minimal mock of window.electron
        global.window = {
            electron: {
                fs: {
                    exists: jest.fn().mockReturnValue(true),
                    mkdir: jest.fn(),
                    readFile: jest.fn().mockImplementation((path) => {
                        // Return empty settings object for any file
                        return '{}';
                    }),
                    writeFile: jest.fn()
                },
                path: {
                    join: jest.fn((...args) => args.join('/'))
                },
                ipcRenderer: {
                    invoke: jest.fn().mockResolvedValue(null),
                    on: jest.fn(),
                    removeAllListeners: jest.fn()
                }
            }
        } as any;
    });

    afterEach(() => {
        // Restore original window
        global.window = originalWindow;
    });

    it('should create a Config instance without errors', () => {
        // Simple test that just verifies we can create a Config instance
        // without it throwing any errors
        expect(() => {
            new Config('/test/storage', '/test/credentials', '/test/config');
        }).not.toThrow();
    });
});