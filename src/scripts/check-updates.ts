import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Set up logging
const logFilePath = path.join(os.homedir(), '.trmx-node', 'logs', 'updater-check.log');
console.log(`Logging to: ${logFilePath}`);

// Create log directory if it doesn't exist
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Set up logger
autoUpdater.logger = {
    info: (message: string) => {
        console.log('[INFO] ' + message);
        fs.appendFileSync(logFilePath, `[INFO] ${new Date().toISOString()} - ${message}\n`);
    },
    warn: (message: string) => {
        console.warn('[WARN] ' + message);
        fs.appendFileSync(logFilePath, `[WARN] ${new Date().toISOString()} - ${message}\n`);
    },
    error: (message: string | Error) => {
        console.error('[ERROR] ' + message);
        fs.appendFileSync(logFilePath, `[ERROR] ${new Date().toISOString()} - ${message}\n`);
    },
    debug: (message: string) => {
        console.log('[DEBUG] ' + message);
        fs.appendFileSync(logFilePath, `[DEBUG] ${new Date().toISOString()} - ${message}\n`);
    }
};

// Enable debug mode
process.env.ELECTRON_LOG_LEVEL = 'debug';

// Configure the updater
console.log('Configuring auto-updater...');
autoUpdater.fullChangelog = true;
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;
autoUpdater.autoRunAppAfterInstall = true;

// Setup event handlers
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available!');
    console.log(JSON.stringify(info, null, 2));

    console.log('Starting download...');
    autoUpdater.downloadUpdate().catch(err => {
        console.error('Download failed:', err);
    });
});

autoUpdater.on('update-not-available', (info) => {
    console.log('No updates available.');
    console.log(JSON.stringify(info, null, 2));
    process.exit(0);
});

autoUpdater.on('download-progress', (progress) => {
    console.log(`Download progress: ${Math.round(progress.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded!');
    console.log(JSON.stringify(info, null, 2));
    console.log('Will quit and install now...');
    autoUpdater.quitAndInstall(true, true);
});

autoUpdater.on('error', (err) => {
    console.error('Error during update check:', err);
    process.exit(1);
});

// Check for updates
console.log(`Current version: ${autoUpdater.currentVersion?.version || 'unknown'}`);
console.log('Checking for updates from S3 bucket...');
autoUpdater.checkForUpdates().catch(err => {
    console.error('Failed to check for updates:', err);
    process.exit(1);
});

// Keep the process alive for a while to allow updates to complete
setTimeout(() => {
    console.log('Timeout reached. Exiting.');
    process.exit(0);
}, 60000); // 1 minute timeout 