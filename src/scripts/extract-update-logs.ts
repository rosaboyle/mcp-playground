import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Path to the log directory
const logDir = path.join(os.homedir(), '.trmx-node', 'logs');
const outputPath = path.join(os.homedir(), '.trmx-node', 'logs', 'update-logs.txt');

console.log(`Searching for update logs in: ${logDir}`);
console.log(`Will write results to: ${outputPath}`);

// Get the 10 most recent log files
const logFiles = fs.readdirSync(logDir)
    .filter(file => file.startsWith('MAIN-') && file.endsWith('.log'))
    .map(file => ({
        path: path.join(logDir, file),
        stats: fs.statSync(path.join(logDir, file))
    }))
    .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()) // Sort by most recent
    .slice(0, 10) // Take only the 10 most recent
    .map(file => file.path);

console.log(`Processing ${logFiles.length} most recent log files`);

// Keywords to search for
const updateKeywords = [
    'update',
    'autoupdate',
    'auto-update',
    'autoUpdater',
    'checking',
    'download',
    'version'
];

// Function to extract logs
function extractUpdateLogs() {
    let results = `Update-Related Log Entries (10 most recent log files)\n`;
    results += `Generated: ${new Date().toISOString()}\n`;
    results += `=================================================\n\n`;

    for (const file of logFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            const matchedLines = lines.filter(line => {
                return updateKeywords.some(keyword =>
                    line.toLowerCase().includes(keyword.toLowerCase())
                );
            });

            if (matchedLines.length > 0) {
                results += `File: ${path.basename(file)}\n`;
                results += `-------------------------------------------------\n`;
                results += matchedLines.join('\n');
                results += '\n\n';
            }
        } catch (err) {
            console.error(`Error processing file ${file}:`, err);
        }
    }

    fs.writeFileSync(outputPath, results);
    console.log(`Extraction complete. Results written to: ${outputPath}`);
}

// Run the extraction
extractUpdateLogs(); 