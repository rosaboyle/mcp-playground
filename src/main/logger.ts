import fs from 'fs';
import os from 'os';
import path from 'path';

// Log levels
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private logLevel: LogLevel = LogLevel.DEBUG;
    private logFile: string | null = null;
    public processType: string;
    private startTime: number;
    private appVersion: string;

    constructor(processType: string) {
        this.processType = processType;
        this.startTime = Date.now();
        this.appVersion = process.env.npm_package_version || '0.1.0';

        // Create log directory if needed
        const logDir = path.join(os.homedir(), '.trmx-node', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Set up log file with timestamp
        const date = new Date();
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
        this.logFile = path.join(logDir, `${processType}-${dateStr}-${timeStr}.log`);

        // Log system info at startup
        this.logSystemInfo();
    }

    private getTimestamp(): string {
        const now = new Date();
        return `${now.toISOString()} [+${Math.floor((Date.now() - this.startTime) / 1000)}s]`;
    }

    private formatMessage(level: string, message: string): string {
        return `${this.getTimestamp()} [${this.processType}] [${level}] ${message}`;
    }

    private writeToFile(message: string): void {
        if (this.logFile) {
            try {
                fs.appendFileSync(this.logFile, message + '\n');
            } catch (error) {
                console.error(`Failed to write to log file: ${(error as Error).message}`);
            }
        }
    }

    private logSystemInfo(): void {
        const systemInfo = [
            `Application Version: ${this.appVersion}`,
            `Electron Version: ${process.versions.electron}`,
            `Chrome Version: ${process.versions.chrome}`,
            `Node Version: ${process.versions.node}`,
            `Platform: ${process.platform}`,
            `Architecture: ${process.arch}`,
            `OS: ${os.type()} ${os.release()}`,
            `CPU Cores: ${os.cpus().length}`,
            `Memory: ${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
            `Free Memory: ${Math.round(os.freemem() / (1024 * 1024 * 1024))} GB`,
            `User Data Path: ${this.logFile?.replace(/\/[^\/]+$/, '')}`
        ];

        this.info('=== SYSTEM INFORMATION ===');
        systemInfo.forEach(info => this.info(info));
        this.info('=========================');
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
        this.info(`Log level set to: ${LogLevel[level]}`);
    }

    debug(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.DEBUG) {
            const formattedMsg = this.formatMessage('DEBUG', message);
            console.log(formattedMsg);
            this.writeToFile(formattedMsg);

            if (data) {
                const dataStr = JSON.stringify(data, null, 2);
                console.log(dataStr);
                this.writeToFile(dataStr);
            }
        }
    }

    info(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.INFO) {
            const formattedMsg = this.formatMessage('INFO', message);
            console.log(formattedMsg);
            this.writeToFile(formattedMsg);

            if (data) {
                const dataStr = JSON.stringify(data, null, 2);
                console.log(dataStr);
                this.writeToFile(dataStr);
            }
        }
    }

    warn(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.WARN) {
            const formattedMsg = this.formatMessage('WARN', message);
            console.warn(formattedMsg);
            this.writeToFile(formattedMsg);

            if (data) {
                const dataStr = JSON.stringify(data, null, 2);
                console.warn(dataStr);
                this.writeToFile(dataStr);
            }
        }
    }

    error(message: string, error?: Error | any): void {
        if (this.logLevel <= LogLevel.ERROR) {
            const formattedMsg = this.formatMessage('ERROR', message);
            console.error(formattedMsg);
            this.writeToFile(formattedMsg);

            if (error) {
                if (error instanceof Error) {
                    const errorDetails = `${error.name}: ${error.message}\nStack: ${error.stack}`;
                    console.error(errorDetails);
                    this.writeToFile(errorDetails);
                } else {
                    const dataStr = JSON.stringify(error, null, 2);
                    console.error(dataStr);
                    this.writeToFile(dataStr);
                }
            }
        }
    }

    // Performance logging
    time(label: string): void {
        console.time(label);
        this.debug(`Starting timer: ${label}`);
    }

    timeEnd(label: string): void {
        console.timeEnd(label);
        this.debug(`Ending timer: ${label}`);
    }

    // Log IPC communication
    logIpcRequest(channel: string, args?: any): void {
        this.debug(`IPC Request: ${channel}`, args);
    }

    logIpcResponse(channel: string, response?: any): void {
        this.debug(`IPC Response: ${channel}`, response);
    }

    // Event logging
    logEvent(source: string, eventName: string, data?: any): void {
        this.debug(`Event: ${source}.${eventName}`, data);
    }
}

// Create singleton instances
export const mainLogger = new Logger('MAIN');
export const preloadLogger = new Logger('PRELOAD');
export const rendererLogger = new Logger('RENDERER');

// Export function to create a new logger instance
export function createLogger(processType: string): Logger {
    return new Logger(processType);
}

// Export based on process type
export default function getLogger(): Logger {
    if (process.type === 'renderer') {
        return rendererLogger;
    } else if (process.type === 'browser') {
        return mainLogger;
    } else {
        return preloadLogger;
    }
} 