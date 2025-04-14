import { contextBridge, ipcRenderer, app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createLogger } from './logger';

const logger = createLogger('preload');
logger.info('Initializing preload script');

// Helper function to wrap file operations with performance metrics and error handling
const wrapWithLogging = <T extends (...args: any[]) => any>(
    operation: string,
    fn: T,
    argFormatter?: (args: Parameters<T>) => any
): ((...args: Parameters<T>) => ReturnType<T>) => {
    return (...args: Parameters<T>): ReturnType<T> => {
        const formattedArgs = argFormatter ? argFormatter(args) : args;
        const operationId = `${operation}-${Date.now()}`;

        logger.time(operationId);
        logger.debug(`Starting ${operation}`, formattedArgs);

        try {
            const result = fn(...args);
            logger.timeEnd(operationId);
            logger.debug(`Completed ${operation}`, { success: true });
            return result;
        } catch (error) {
            logger.timeEnd(operationId);
            logger.error(`Failed ${operation}`, error);
            throw error;
        }
    };
};

// Sanitize file path for logging (remove full path for security)
const sanitizePath = (filePath: string): string => {
    // Use a cross-platform regex that handles both forward and backward slashes
    return filePath.replace(/^.*[\/\\]/, '...');
};

// Expose APIs to the renderer process
contextBridge.exposeInMainWorld('electron', {
    // IPC Renderer API
    ipcRenderer: {
        invoke: (channel: string, ...args: any[]) => {
            logger.debug(`ipcRenderer.invoke(${channel})`);
            // Handle special is-dev check directly in preload
            if (channel === 'is-dev') {
                // Check if app is running in dev mode (you can adjust this logic)
                const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
                logger.debug(`is-dev check: ${isDev}`);
                return Promise.resolve(isDev);
            }
            return ipcRenderer.invoke(channel, ...args);
        },
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
            logger.debug(`ipcRenderer.on(${channel})`);
            const subscription = (_event: any, ...args: any[]) => listener(_event, ...args);
            ipcRenderer.on(channel, subscription);
            return () => {
                logger.debug(`Removing listener for ${channel}`);
                ipcRenderer.removeListener(channel, subscription);
            };
        },
        removeAllListeners: (channel: string) => {
            logger.debug(`ipcRenderer.removeAllListeners(${channel})`);
            ipcRenderer.removeAllListeners(channel);
        }
    },

    // Filesystem API
    fs: {
        readFile: (filepath: string, options: any) => {
            logger.debug(`fs.readFile(${filepath})`);
            return fs.readFileSync(filepath, options);
        },
        writeFile: (filepath: string, data: any, options: any) => {
            logger.debug(`fs.writeFile(${filepath})`);
            fs.writeFileSync(filepath, data, options);
        },
        readdir: (dirpath: string) => {
            logger.debug(`fs.readdir(${dirpath})`);
            return fs.readdirSync(dirpath);
        },
        mkdir: (dirpath: string, options: any) => {
            logger.debug(`fs.mkdir(${dirpath})`);
            fs.mkdirSync(dirpath, options);
        },
        exists: (filepath: string) => {
            logger.debug(`fs.exists(${filepath})`);
            return fs.existsSync(filepath);
        },
        stat: (filepath: string) => {
            logger.debug(`fs.stat(${filepath})`);
            return fs.statSync(filepath);
        },
        unlink: (filepath: string) => {
            logger.debug(`fs.unlink(${filepath})`);
            fs.unlinkSync(filepath);
        }
    },

    // Path API
    path: {
        join: (...paths: string[]) => {
            return path.join(...paths);
        },
        resolve: (...paths: string[]) => {
            return path.resolve(...paths);
        },
        basename: (filepath: string, ext?: string) => {
            return path.basename(filepath, ext);
        },
        dirname: (filepath: string) => {
            return path.dirname(filepath);
        },
        extname: (filepath: string) => {
            return path.extname(filepath);
        },
        // Add normalize to help with cross-platform path issues
        normalize: (filepath: string) => {
            return path.normalize(filepath);
        }
    },

    // OS API
    os: {
        homedir: () => {
            return os.homedir();
        },
        platform: () => {
            return os.platform();
        },
        release: () => {
            return os.release();
        }
    },

    // Auto Updater API
    updater: {
        checkForUpdates: () => {
            logger.debug('updater.checkForUpdates');
            return ipcRenderer.invoke('check-for-updates');
        },
        downloadUpdate: () => {
            logger.debug('updater.downloadUpdate');
            return ipcRenderer.invoke('download-update');
        },
        quitAndInstall: () => {
            logger.debug('updater.quitAndInstall');
            return ipcRenderer.invoke('quit-and-install');
        },
        onUpdateAvailable: (callback: (info: any) => void) => {
            logger.debug('updater.onUpdateAvailable - registering listener');
            return ipcRenderer.on('update-available', (_event, info) => {
                logger.debug(`Received update-available event: ${JSON.stringify(info)}`);
                callback(info);
            });
        },
        onUpdateDownloaded: (callback: () => void) => {
            logger.debug('updater.onUpdateDownloaded - registering listener');
            return ipcRenderer.on('update-downloaded', () => {
                logger.debug('Received update-downloaded event');
                callback();
            });
        },
        onUpdateError: (callback: (message: string) => void) => {
            logger.debug('updater.onUpdateError - registering listener');
            return ipcRenderer.on('update-error', (_event, message) => {
                logger.debug(`Received update-error event: ${message}`);
                callback(message);
            });
        },
        onDownloadProgress: (callback: (progressObj: any) => void) => {
            logger.debug('updater.onDownloadProgress - registering listener');
            return ipcRenderer.on('download-progress', (_event, progressObj) => {
                logger.debug(`Received download-progress event: ${JSON.stringify(progressObj)}`);
                callback(progressObj);
            });
        }
    },

    // AI Functionality
    ai: {
        initializeProvider: (provider: string, apiKey: string) => {
            logger.debug(`ai.initializeProvider(${provider})`);
            return ipcRenderer.invoke('ai:initialize-provider', provider, apiKey);
        },
        isProviderInitialized: (provider: string) => {
            logger.debug(`ai.isProviderInitialized(${provider})`);
            return ipcRenderer.invoke('ai:is-provider-initialized', provider);
        },
        listModels: (provider: string) => {
            logger.debug(`ai.listModels(${provider})`);
            return ipcRenderer.invoke('ai:list-models', provider);
        },
        chatCompletion: (provider: string, model: string, messages: any[], options?: any) => {
            logger.debug(`ai.chatCompletion(${provider}, ${model}, messages[${messages.length}])`);
            console.log(`[MODEL PRELOAD] chatCompletion with provider: ${provider}, model: ${model}`);
            return ipcRenderer.invoke('ai:chat-completion', provider, model, messages, options);
        },
        streamChatCompletion: (provider: string, model: string, messages: any[], options?: any) => {
            logger.debug(`ai.streamChatCompletion(${provider}, ${model}, messages[${messages.length}])`);
            console.log(`[MODEL PRELOAD] streamChatCompletion with provider: ${provider}, model: ${model}`);
            return ipcRenderer.invoke('ai:stream-chat-completion', provider, model, messages, options);
        },
        cancelStream: (streamId: string) => {
            logger.debug(`ai.cancelStream(${streamId})`);
            return ipcRenderer.invoke('ai:cancel-stream', streamId);
        },
        onStreamResponse: (callback: (data: any) => void) => {
            logger.debug('ai.onStreamResponse - registering listener');
            // Register for stream events with the main process
            ipcRenderer.send('ai:register-stream-listeners');
            return ipcRenderer.on('ai:stream-response', (_event, data) => {
                logger.debug(`Received stream response for ${data.streamId}, chunk length: ${data.chunk?.content?.length || 0}`);
                callback(data);
            });
        },
        onStreamError: (callback: (data: any) => void) => {
            logger.debug('ai.onStreamError - registering listener');
            return ipcRenderer.on('ai:stream-error', (_event, data) => {
                logger.debug(`Received stream error for ${data.streamId}: ${data.error}`);
                callback(data);
            });
        },
        onStreamEnd: (callback: (data: any) => void) => {
            logger.debug('ai.onStreamEnd - registering listener');
            return ipcRenderer.on('ai:stream-end', (_event, data) => {
                logger.debug(`Received stream end for ${data.streamId}`);
                callback(data);
            });
        },
        removeStreamListeners: () => {
            logger.debug('ai.removeStreamListeners');
            ipcRenderer.send('ai:remove-stream-listeners');
            ipcRenderer.removeAllListeners('ai:stream-response');
            ipcRenderer.removeAllListeners('ai:stream-error');
            ipcRenderer.removeAllListeners('ai:stream-end');
        }
    },

    // MCP Functionality
    mcp: {
        getServers: () => {
            logger.debug('mcp.getServers');
            return ipcRenderer.invoke('mcp-get-servers');
        },
        connect: (serverId: string, connectionId: string) => {
            logger.debug(`mcp.connect(${serverId}, ${connectionId})`);
            return ipcRenderer.invoke('mcp-connect', serverId, connectionId);
        },
        disconnect: (connectionId: string) => {
            logger.debug(`mcp.disconnect(${connectionId})`);
            return ipcRenderer.invoke('mcp-disconnect', connectionId);
        },
        getActiveConnections: () => {
            logger.debug('mcp.getActiveConnections');
            return ipcRenderer.invoke('mcp-get-active-connections');
        },
        listTools: (connectionId: string) => {
            logger.debug(`mcp.listTools(${connectionId})`);
            return ipcRenderer.invoke('mcp-list-tools', connectionId);
        },
        listResources: (connectionId: string) => {
            logger.debug(`mcp.listResources(${connectionId})`);
            return ipcRenderer.invoke('mcp-list-resources', connectionId);
        },
        listPrompts: (connectionId: string) => {
            logger.debug(`mcp.listPrompts(${connectionId})`);
            return ipcRenderer.invoke('mcp-list-prompts', connectionId);
        },
        getConfig: () => {
            logger.debug('mcp.getConfig');
            return ipcRenderer.invoke('mcp-get-config');
        },
        saveConfig: (config: any) => {
            logger.debug('mcp.saveConfig');
            return ipcRenderer.invoke('mcp-save-config', config);
        }
    },

    // Add app API
    app: {
        getVersion: () => {
            logger.debug('app.getVersion');
            return app.getVersion();
        }
    }
});

logger.info('Preload script initialization complete'); 