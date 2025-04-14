import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { mainLogger as logger } from './logger';
import { airtrainService } from './services/airtrain-service';
import { setupMCPService } from './services/mcpService';

// Keep a global reference of the window object to avoid garbage collection
let mainWindow: BrowserWindow | null = null;

// Create the Airtrain service at module level
// const airtrainService = new AirtrainService();

// Default app folders - Ensure paths are Windows compatible
const storageDir = path.join(os.homedir(), '.trmx-node', 'messages');
const credentialsDir = path.join(os.homedir(), '.trmx-node', 'credentials');
const configDir = path.join(os.homedir(), '.trmx-node', 'config');

// Track active streams for cancellation
const activeStreams: Map<string, { cancel: () => void }> = new Map();

// Set up auto updater
function setupAutoUpdater() {
    logger.info('Setting up auto updater');
    logger.info(`Auto-update feature is enabled. Current version: ${app.getVersion()}`);

    // Configure logging for autoUpdater - Set to verbose for detailed logs
    autoUpdater.logger = logger;

    // Normally electron-updater skips update checks for non-packaged apps (dev mode)
    // Force it to allow checking for updates even in development mode
    logger.info('Configuring electron-updater to allow checking in development mode');
    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
    if (isDev) {
        logger.info('Development mode detected - forcing update config to enable checking');
        process.env.ELECTRON_UPDATER_DEV = '1';
    }

    // The files have been published to the correct path, but we were accessing them incorrectly
    // Setting the feed URL to the exact location where the update files are stored
    const platform = process.platform === 'darwin' ? 'mac' : process.platform;
    const s3BaseUrl = `https://mcpx.s3.amazonaws.com/builds/${platform}/latest`;
    logger.info(`Setting updater base URL to: ${s3BaseUrl}`);

    // The updater yaml file is at /builds/mac/latest/latest-mac.yml
    if (process.platform === 'darwin') {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: s3BaseUrl,
            useMultipleRangeRequest: false
        });
    } else if (process.platform === 'win32') {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: s3BaseUrl,
            useMultipleRangeRequest: false
        });
    } else {
        autoUpdater.setFeedURL({
            provider: 'generic',
            url: s3BaseUrl,
            useMultipleRangeRequest: false
        });
    }

    // Don't auto download updates
    autoUpdater.autoDownload = false;

    // Enable more verbose logging for the updater
    logger.info('Setting up detailed logs for auto-updater');
    if (isDev) {
        // Enable full logging when in development mode
        autoUpdater.fullChangelog = true;
        logger.info('Running in development mode - but updates are enabled for testing');
    } else {
        logger.info('Running in production mode - checking for updates from correct S3 path');
    }

    // Check for updates when the app starts
    autoUpdater.on('checking-for-update', () => {
        logger.info('Checking for updates');
        if (mainWindow) {
            mainWindow.webContents.send('update-message', 'Checking for updates...');
        }
    });

    autoUpdater.on('update-available', (info) => {
        logger.info('Update available', info);
        if (mainWindow) {
            mainWindow.webContents.send('update-available', info);
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update Available',
                message: `Version ${info.version} is available. Do you want to download it now?`,
                buttons: ['Yes', 'No']
            }).then(({ response }) => {
                if (response === 0) {
                    autoUpdater.downloadUpdate();
                }
            });
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        logger.info('No update available', info);
        if (mainWindow) {
            mainWindow.webContents.send('update-not-available');
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        logger.debug('Download progress', progressObj);
        if (mainWindow) {
            mainWindow.webContents.send('download-progress', progressObj);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        logger.info('Update downloaded', info);
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded');
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Update Ready',
                message: 'A new version has been downloaded. Restart the application to apply the updates.',
                buttons: ['Restart', 'Later']
            }).then(({ response }) => {
                if (response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
        }
    });

    autoUpdater.on('error', (err) => {
        logger.error('Auto updater error', err);
        if (mainWindow) {
            mainWindow.webContents.send('update-error', err.message);
        }
    });
}

// Ensure directories exist
function ensureDirectories() {
    logger.info('Ensuring application directories exist');
    [storageDir, credentialsDir, configDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            logger.info(`Creating directory: ${dir}`);
            try {
                fs.mkdirSync(dir, { recursive: true });
                logger.info(`Directory created successfully: ${dir}`);
            } catch (error) {
                logger.error(`Failed to create directory: ${dir}`, error);
            }
        } else {
            logger.info(`Directory already exists: ${dir}`);
        }
    });
    logger.info('Directory verification complete');
}

function createWindow() {
    logger.time('window-creation');
    logger.info('Creating main application window');

    try {
        // Create browser window with detailed configuration
        logger.debug('Configuring browser window');
        const windowConfig = {
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
                sandbox: false
            },
        };

        logger.debug('Window configuration', windowConfig);
        mainWindow = new BrowserWindow(windowConfig);
        logger.info('Browser window instance created');

        // Set up event handlers
        logger.info('Setting up window event handlers');
        setupWindowEventHandlers();

        // Load the application
        if (process.argv.includes('--dev')) {
            logger.info('Application running in development mode');
            // Use path.resolve for more robust path handling across platforms
            const indexPath = path.resolve(__dirname, '..', 'renderer', 'index.html');
            logger.debug(`Loading HTML file from: ${indexPath}`);

            mainWindow.loadFile(indexPath);

            // Open DevTools in development mode
            logger.info('Opening DevTools for development');
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        } else {
            logger.info('Application running in production mode');
            // Use path.resolve for more robust path handling across platforms
            const indexPath = path.resolve(__dirname, '..', 'renderer', 'index.html');
            logger.debug(`Loading HTML file from: ${indexPath}`);

            mainWindow.loadFile(indexPath);
        }

        logger.info('Main window fully created and configured');
        logger.timeEnd('window-creation');
    } catch (error) {
        logger.error('Failed to create main window', error);
    }
}

function setupWindowEventHandlers() {
    if (!mainWindow) {
        logger.error('Failed to set up window event handlers - mainWindow is null');
        return;
    }

    // Open external links in the browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        logger.info(`Opening external URL in browser: ${url}`);
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Log when page has loaded
    mainWindow.webContents.on('did-finish-load', () => {
        logger.info('Renderer page has finished loading');
    });

    // Log any page errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        logger.error(`Failed to load page: ${errorDescription} (${errorCode})`);
    });

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        logger.info('Main window closed');
        mainWindow = null;
    });

    // Log navigation events
    mainWindow.webContents.on('will-navigate', (event, url) => {
        logger.info(`Navigation requested to: ${url}`);
    });

    // Log console messages from renderer
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levels = ['debug', 'info', 'warning', 'error'];
        logger.debug(`[RENDERER CONSOLE] [${levels[level] || 'log'}] ${message}`);
    });

    // Monitor renderer process
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        logger.error(`Renderer process gone: ${details.reason}`, details);
    });

    // Log responsive/unresponsive events
    mainWindow.on('unresponsive', () => {
        logger.warn('Main window has become unresponsive');
    });

    mainWindow.on('responsive', () => {
        logger.info('Main window has become responsive again');
    });

    logger.info('All window event handlers configured successfully');
}

// Application startup sequence
function startupSequence() {
    logger.info('Starting application');
    logger.time('app-startup');

    try {
        logger.info('Checking application directories');
        ensureDirectories();

        logger.info('Creating main application window');
        createWindow();

        // Set up IPC handlers
        logger.info('Setting up IPC handlers');
        setupIpcHandlers();

        // Set up and check for updates
        logger.info('Setting up auto updater');
        setupAutoUpdater();

        // Check for updates, but not in development mode
        if (!process.argv.includes('--dev')) {
            logger.info('Initiating check for updates');
            logger.info(`Current app version: ${app.getVersion()}`);

            autoUpdater.checkForUpdates()
                .then(updateCheckResult => {
                    logger.info(`Update check completed: ${JSON.stringify(updateCheckResult || 'No result')}`);
                })
                .catch(err => {
                    // Just log the error but don't display to user on startup
                    logger.error('Error checking for updates', err);
                });
        } else {
            logger.info('Skipping update check in development mode');
        }

        logger.info('Application startup sequence completed successfully');
    } catch (error) {
        logger.error('Error during application startup', error);
    }

    logger.timeEnd('app-startup');
}

// IPC handler setup
function setupIpcHandlers() {
    logger.info('Registering IPC handlers');

    // App paths handler
    ipcMain.handle('get-app-paths', (event) => {
        logger.logIpcRequest('get-app-paths');
        const response = {
            storageDir,
            credentialsDir,
            configDir
        };
        logger.logIpcResponse('get-app-paths', response);
        return response;
    });

    // Auto-update handlers
    ipcMain.handle('check-for-updates', async () => {
        logger.info('Manual update check requested');
        // Allow updates in dev mode when forced via environment variable
        if (process.argv.includes('--dev') && !process.env.ELECTRON_UPDATER_DEV) {
            logger.info('Updates are disabled in development mode, but can be enabled with ELECTRON_UPDATER_DEV=1');
            return { success: false, message: 'Updates are disabled in development mode. Run with ELECTRON_UPDATER_DEV=1 to enable.' };
        }

        try {
            logger.info('Checking for updates from configured S3 bucket');
            logger.info(`Using URL: https://mcpx.s3.amazonaws.com/builds/${process.platform === 'darwin' ? 'mac' : process.platform}/latest/latest-${process.platform === 'darwin' ? 'mac' : 'win'}.yml`);

            const result = await autoUpdater.checkForUpdates();
            logger.info(`Update check result: ${JSON.stringify(result || 'No result')}`);
            return { success: true };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error checking for updates';
            logger.error(`Error checking for updates: ${errorMsg}`, error);

            // Check for specific error conditions
            let detailedError = errorMsg;

            // Special handling for the specific 403 error we're seeing
            if (errorMsg.includes('https://mcpx.s3.amazonaws.com/latest-mac.yml') &&
                errorMsg.includes('403 Forbidden')) {
                detailedError = 'Update server configuration issue. The update files are being searched in the wrong location.';
                logger.error('Update path misconfiguration detected. The app is looking for update files in the wrong path.');
            }
            // Check for development mode specific errors
            else if (errorMsg.includes('dev app') || errorMsg.includes('not packed') ||
                errorMsg.includes('APPIMAGE env or file is not defined')) {
                detailedError = 'Updates are not available in development mode. Please package the app first.';
                logger.error('Development mode update checking error');
            }
            // General access denied handling
            else if (errorMsg.includes('403') || errorMsg.includes('Forbidden') ||
                errorMsg.includes('AccessDenied') || errorMsg.includes('Access Denied')) {
                detailedError = 'Access denied to update server. Please verify S3 bucket permissions.';
                logger.error('Access denied error detected when checking for updates');
            }

            return {
                success: false,
                message: detailedError
            };
        }
    });

    ipcMain.handle('download-update', async () => {
        logger.info('Manual update download requested');
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (error) {
            logger.error('Error downloading update', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error downloading update'
            };
        }
    });

    ipcMain.handle('quit-and-install', () => {
        logger.info('Quit and install requested');
        autoUpdater.quitAndInstall(true, true);
        return { success: true };
    });

    // Dialog handler
    ipcMain.handle('show-dialog', async (event, options) => {
        logger.logIpcRequest('show-dialog', options);
        try {
            const result = await dialog.showOpenDialog(options);
            logger.logIpcResponse('show-dialog', result);
            return result;
        } catch (error) {
            logger.error('Error showing dialog', error);
            throw error;
        }
    });

    // Environment variable handler
    ipcMain.handle('get-env-variable', (event, name) => {
        logger.logIpcRequest('get-env-variable', { name });
        const value = process.env[name];
        // Don't log actual API keys, just whether they exist
        logger.logIpcResponse('get-env-variable', {
            name,
            exists: !!value,
            length: value ? value.length : 0
        });
        return value;
    });

    // --- AI-related IPC handlers ---

    // Initialize provider with API key
    ipcMain.handle('ai:initialize-provider', async (_, provider: string, apiKey: string) => {
        logger.debug(`Initializing AI provider: ${provider}`);
        try {
            const initialized = await airtrainService.initializeProvider(provider, apiKey);
            logger.debug(`Provider ${provider} initialization result: ${initialized}`);
            return initialized;
        } catch (error) {
            logger.error(`Failed to initialize provider ${provider}:`, error);
            return false;
        }
    });

    // Check if provider is initialized
    ipcMain.handle('ai:is-provider-initialized', async (_, provider: string) => {
        try {
            return await airtrainService.isProviderInitialized(provider);
        } catch (error) {
            logger.error(`Failed to check if provider ${provider} is initialized:`, error);
            return false;
        }
    });

    // List available models for a provider
    ipcMain.handle('ai:list-models', async (_, provider: string) => {
        try {
            return await airtrainService.listModels(provider);
        } catch (error) {
            logger.error(`Failed to list models for provider ${provider}:`, error);
            return [];
        }
    });

    // Chat completion
    ipcMain.handle('ai:chat-completion', async (_, provider: string, model: string, messages: any[], options?: any) => {
        try {
            return await airtrainService.chatCompletion(provider, model, messages, options);
        } catch (error) {
            logger.error(`Error during chat completion:`, error);
            throw error;
        }
    });

    // Streaming chat completion
    ipcMain.handle('ai:stream-chat-completion', async (_, provider: string, model: string, messages: any[], options?: any) => {
        try {
            return await airtrainService.streamChatCompletion(provider, model, messages, options);
        } catch (error) {
            logger.error(`Error initiating streaming chat completion:`, error);
            throw error;
        }
    });

    // Cancel streaming request
    ipcMain.handle('ai:cancel-stream', async (_, streamId: string) => {
        try {
            return await airtrainService.cancelStream(streamId);
        } catch (error) {
            logger.error(`Error canceling stream ${streamId}:`, error);
            return false;
        }
    });

    // Function to manage event listeners for stream events
    const streamResponseListeners = new Map();
    const streamErrorListeners = new Map();
    const streamEndListeners = new Map();

    // Create event emitters to handle stream events
    const streamEvents = new EventEmitter();

    // Set up IPC handlers for stream events
    ipcMain.on('ai:register-stream-listeners', (event) => {
        const webContentsId = event.sender.id;

        // Set up event listeners if not already set up
        if (!streamResponseListeners.has(webContentsId)) {
            const responseListener = (data: any) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send('ai:stream-response', data);
                }
            };
            streamEvents.on('stream-response', responseListener);
            streamResponseListeners.set(webContentsId, responseListener);
        }

        if (!streamErrorListeners.has(webContentsId)) {
            const errorListener = (data: any) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send('ai:stream-error', data);
                }
            };
            streamEvents.on('stream-error', errorListener);
            streamErrorListeners.set(webContentsId, errorListener);
        }

        if (!streamEndListeners.has(webContentsId)) {
            const endListener = (data: any) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send('ai:stream-end', data);
                }
            };
            streamEvents.on('stream-end', endListener);
            streamEndListeners.set(webContentsId, endListener);
        }

        logger.debug(`Registered stream listeners for WebContents ID ${webContentsId}`);
    });

    ipcMain.on('ai:remove-stream-listeners', (event) => {
        const webContentsId = event.sender.id;

        // Clean up listeners
        if (streamResponseListeners.has(webContentsId)) {
            streamEvents.removeListener('stream-response', streamResponseListeners.get(webContentsId));
            streamResponseListeners.delete(webContentsId);
        }

        if (streamErrorListeners.has(webContentsId)) {
            streamEvents.removeListener('stream-error', streamErrorListeners.get(webContentsId));
            streamErrorListeners.delete(webContentsId);
        }

        if (streamEndListeners.has(webContentsId)) {
            streamEvents.removeListener('stream-end', streamEndListeners.get(webContentsId));
            streamEndListeners.delete(webContentsId);
        }

        logger.debug(`Removed stream listeners for WebContents ID ${webContentsId}`);
    });

    // Forward Airtrain service events to our streamEvents emitter
    airtrainService.eventEmitter.on('stream-response', (data: any) => {
        console.log(`[DEBUG-MAIN] Forwarding stream-response event for ${data.streamId}, chunk length: ${data.chunk?.content?.length || 0}`);
        streamEvents.emit('stream-response', data);
    });

    airtrainService.eventEmitter.on('stream-error', (data: any) => {
        console.log(`[DEBUG-MAIN] Forwarding stream-error event for ${data.streamId}: ${data.error}`);
        streamEvents.emit('stream-error', data);
    });

    airtrainService.eventEmitter.on('stream-end', (data: any) => {
        console.log(`[DEBUG-MAIN] Forwarding stream-end event for ${data.streamId}`);
        streamEvents.emit('stream-end', data);
    });

    // --- MCP-related IPC handlers ---
    try {
        logger.info('Setting up MCP service');
        setupMCPService(configDir);
        logger.info('MCP service setup successful');
    } catch (error) {
        logger.error('Failed to set up MCP service', error);
    }

    logger.info('All IPC handlers registered successfully');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(() => {
    logger.info('Electron app is ready');
    startupSequence();

    app.on('activate', () => {
        logger.info('App activated');
        // On macOS it's common to re-create a window when the dock icon is clicked
        if (mainWindow === null) {
            logger.info('Recreating window on activate (macOS behavior)');
            createWindow();
        }
    });
});

// Register shutdown handlers
app.on('before-quit', () => {
    logger.info('Application is about to quit - cleaning up resources');

    // Cancel any active streams
    for (const [streamId, { cancel }] of activeStreams.entries()) {
        logger.debug(`Cancelling stream ${streamId} before quit`);
        cancel();
    }

    // Clean up airtrain service
    logger.info('Disposing AirtrainService');
    airtrainService.dispose();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    logger.info('All windows closed');
    if (process.platform !== 'darwin') {
        logger.info('Quitting app (not on macOS)');
        app.quit();
    }
});

// Log uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in main process', error);
});

// Log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection in main process', { reason });
});

logger.info('Main process module loaded'); 