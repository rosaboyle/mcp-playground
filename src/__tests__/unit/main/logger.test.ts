import { LogLevel, createLogger, mainLogger, preloadLogger, rendererLogger } from '../../../main/logger';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock dependencies before importing the module under test
jest.mock('fs', () => ({
    existsSync: jest.fn((p) => {
        // Return false for log directory to ensure mkdir is called
        if (p.includes('logs')) {
            return false;
        }
        return true;
    }),
    mkdirSync: jest.fn(),
    appendFileSync: jest.fn()
}));

jest.mock('os', () => ({
    homedir: jest.fn().mockReturnValue('/mock/home'),
    type: jest.fn().mockReturnValue('Mock OS'),
    release: jest.fn().mockReturnValue('1.0.0'),
    cpus: jest.fn().mockReturnValue([{}, {}, {}]),
    totalmem: jest.fn().mockReturnValue(8 * 1024 * 1024 * 1024), // 8GB
    freemem: jest.fn().mockReturnValue(4 * 1024 * 1024 * 1024) // 4GB
}));

jest.mock('path', () => ({
    join: jest.fn().mockImplementation((...args) => args.join('/'))
}));

// Create mock versions for process
const mockVersions = {
    electron: '10.0.0',
    chrome: '80.0.0',
    node: '14.0.0'
};

// Now tests begin
describe('Logger Module', () => {
    // Original console methods
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    const originalConsoleTime = console.time;
    const originalConsoleTimeEnd = console.timeEnd;

    // Store original process values
    const originalType = process.type;
    const originalVersions = process.versions;
    const originalPlatform = process.platform;
    const originalArch = process.arch;
    const originalPackageVersion = process.env.npm_package_version;

    // Setup mocks before each test
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock console methods
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
        console.time = jest.fn();
        console.timeEnd = jest.fn();

        // Mock process properties safely using Object.defineProperty
        // @ts-ignore - we're mocking process.type which TypeScript doesn't know about
        Object.defineProperty(process, 'type', { value: 'browser', configurable: true });
        Object.defineProperty(process, 'versions', { value: mockVersions, configurable: true });
        Object.defineProperty(process, 'platform', { value: 'mock-platform', configurable: true });
        Object.defineProperty(process, 'arch', { value: 'mock-arch', configurable: true });

        // Mock package version
        process.env.npm_package_version = '1.0.0';
    });

    // Restore console methods and process properties after each test
    afterEach(() => {
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
        console.time = originalConsoleTime;
        console.timeEnd = originalConsoleTimeEnd;

        // Restore process properties
        Object.defineProperty(process, 'type', { value: originalType, configurable: true });
        Object.defineProperty(process, 'versions', { value: originalVersions, configurable: true });
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
        Object.defineProperty(process, 'arch', { value: originalArch, configurable: true });

        // Restore env variable
        if (originalPackageVersion) {
            process.env.npm_package_version = originalPackageVersion;
        } else {
            delete process.env.npm_package_version;
        }
    });

    describe('Logger Class', () => {
        it('creates a new logger instance with correct initialization', () => {
            const logger = createLogger('TEST');

            // Should have created log directory if it doesn't exist
            expect(fs.existsSync).toHaveBeenCalled();
            expect(fs.mkdirSync).toHaveBeenCalled();

            // Should have logged system info
            expect(console.log).toHaveBeenCalled();
        });

        it('logs messages at different levels', () => {
            const logger = createLogger('TEST');

            logger.debug('Debug message');
            logger.info('Info message');
            logger.warn('Warning message');
            logger.error('Error message');

            // Each message should have been logged and written to file
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DEBUG] Debug message'));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('INFO] Info message'));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WARN] Warning message'));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ERROR] Error message'));
        });

        it('logs additional data objects', () => {
            const logger = createLogger('TEST');
            const testData = { foo: 'bar' };

            logger.debug('Debug with data', testData);
            logger.info('Info with data', testData);
            logger.warn('Warn with data', testData);
            logger.error('Error with data', testData);

            // Verify log messages with data
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DEBUG] Debug with data'));
            expect(console.log).toHaveBeenCalledWith(JSON.stringify(testData, null, 2));

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('INFO] Info with data'));
            expect(console.log).toHaveBeenCalledWith(JSON.stringify(testData, null, 2));

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WARN] Warn with data'));
            expect(console.warn).toHaveBeenCalledWith(JSON.stringify(testData, null, 2));

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ERROR] Error with data'));
            expect(console.error).toHaveBeenCalledWith(JSON.stringify(testData, null, 2));
        });

        it('respects log level settings', () => {
            const logger = createLogger('TEST');

            // Clear mocks after initialization
            jest.clearAllMocks();

            logger.setLogLevel(LogLevel.WARN);

            logger.debug('Debug message');
            logger.info('Info message');
            logger.warn('Warning message');
            logger.error('Error message');

            // Only WARN and ERROR should be logged
            expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('DEBUG] Debug message'));
            expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('INFO] Info message'));
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WARN] Warning message'));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ERROR] Error message'));
        });

        it('handles errors when writing to log file', () => {
            (fs.appendFileSync as jest.Mock).mockImplementation(() => {
                throw new Error('Write error');
            });

            const logger = createLogger('TEST');
            logger.info('Test message');

            // Should have caught and logged the error
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to write to log file'));
        });

        it('logs detailed error objects', () => {
            const logger = createLogger('TEST');
            const error = new Error('Test error');
            error.stack = 'mock stack trace';

            logger.error('An error occurred', error);

            // Should log the error with stack trace
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error:'));
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('mock stack trace'));
        });

        it('provides timer functionality', () => {
            const logger = createLogger('TEST');

            logger.time('test-timer');
            logger.timeEnd('test-timer');

            expect(console.time).toHaveBeenCalledWith('test-timer');
            expect(console.timeEnd).toHaveBeenCalledWith('test-timer');
        });

        it('logs IPC communication', () => {
            const logger = createLogger('TEST');

            logger.logIpcRequest('test-channel', { data: 'test' });
            logger.logIpcResponse('test-channel', { result: 'success' });

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('IPC Request: test-channel'));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('IPC Response: test-channel'));
        });

        it('logs events', () => {
            const logger = createLogger('TEST');

            logger.logEvent('TestComponent', 'click', { target: 'button' });

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Event: TestComponent.click'));
        });
    });

    describe('Logger Exports', () => {
        it('exports singleton instances', () => {
            expect(mainLogger).toBeDefined();
            expect(preloadLogger).toBeDefined();
            expect(rendererLogger).toBeDefined();
        });

        it('selects the correct logger based on process type', () => {
            // Clear previous instances and re-import to get fresh loggers
            jest.resetModules();

            // Set process.type to 'browser'
            Object.defineProperty(process, 'type', { value: 'browser', configurable: true });

            // Need to reimport to get fresh instances with correct name
            const { mainLogger: freshMainLogger } = require('../../../main/logger');
            expect(freshMainLogger.processType).toBe('MAIN');

            // Set process.type to 'renderer'
            Object.defineProperty(process, 'type', { value: 'renderer', configurable: true });

            // Need to reimport to get fresh instances with correct name
            const { rendererLogger: freshRendererLogger } = require('../../../main/logger');
            expect(freshRendererLogger.processType).toBe('RENDERER');
        });
    });
});

describe('LogLevel enum', () => {
    it('has the correct log levels defined', () => {
        expect(LogLevel.DEBUG).toBe(0);
        expect(LogLevel.INFO).toBe(1);
        expect(LogLevel.WARN).toBe(2);
        expect(LogLevel.ERROR).toBe(3);
    });
});

describe('createLogger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('creates a new logger with the specified process type', () => {
        const logger = createLogger('TEST');
        expect(logger).toBeDefined();
    });
}); 