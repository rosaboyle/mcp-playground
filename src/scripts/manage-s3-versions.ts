/**
 * S3 Version Management Script
 * 
 * This script helps manage versioned builds in the S3 bucket.
 * It can:
 * - List all available versions
 * - Update the "latest" symlink to point to a specific version
 * - Clean up old versions (optional)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Configuration
const S3_BUCKET = 'mcpx';
const PLATFORMS = ['mac', 'win', 'linux'];

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
    console.log(`
Usage: npm run manage-s3 [command] [options]

Commands:
  list                     List all available versions for all platforms
  list [platform]          List all available versions for a specific platform
  update-latest [version]  Update the "latest" symlink to point to a specific version
  clean [keep-count]       Clean up old versions, keeping the latest [keep-count] versions

Examples:
  npm run manage-s3 list
  npm run manage-s3 list mac
  npm run manage-s3 update-latest 0.2.1
  npm run manage-s3 clean 5
  `);
}

function listVersions(platform?: string) {
    const platformList = platform ? [platform] : PLATFORMS;

    for (const plat of platformList) {
        console.log(`\n=== ${plat.toUpperCase()} Versions ===`);

        try {
            // List all versions in the platform directory
            const result = execSync(`aws s3 ls s3://${S3_BUCKET}/builds/${plat}/`, { encoding: 'utf-8' });

            // Parse the result and show versions
            const versions = result
                .split('\n')
                .filter(line => line.includes('PRE'))
                .map(line => {
                    const match = line.match(/PRE (.+)\//);
                    return match ? match[1] : null;
                })
                .filter(Boolean)
                .filter(v => v !== 'latest' && v !== 'dev');

            if (versions.length === 0) {
                console.log('No versions found');
            } else {
                versions.sort((a, b) => {
                    // Sort versions in descending order (newest first)
                    const verA = a!.split('.').map(Number);
                    const verB = b!.split('.').map(Number);

                    for (let i = 0; i < Math.max(verA.length, verB.length); i++) {
                        const numA = i < verA.length ? verA[i] : 0;
                        const numB = i < verB.length ? verB[i] : 0;

                        if (numA !== numB) {
                            return numB - numA;
                        }
                    }

                    return 0;
                });

                // Check which one is set as latest
                let latestVersion = '';
                try {
                    const latestResult = execSync(`aws s3 ls s3://${S3_BUCKET}/builds/${plat}/latest/`, { encoding: 'utf-8' });
                    // We can't directly see what version latest points to, so this is just informational
                } catch (error) {
                    // Ignore errors
                }

                versions.forEach((version, index) => {
                    console.log(`${index + 1}. ${version}${version === latestVersion ? ' (latest)' : ''}`);
                });
            }
        } catch (error) {
            console.error(`Error listing versions for ${plat}:`, error);
        }
    }
}

function updateLatest(version: string) {
    if (!version) {
        console.error('Error: Version is required');
        printUsage();
        process.exit(1);
    }

    for (const platform of PLATFORMS) {
        console.log(`Updating latest for ${platform} to version ${version}...`);

        try {
            // First check if the version exists
            try {
                execSync(`aws s3 ls s3://${S3_BUCKET}/builds/${platform}/${version}/`, { encoding: 'utf-8' });
            } catch (error) {
                console.error(`Error: Version ${version} not found for ${platform}`);
                continue;
            }

            // Copy the versioned build to latest
            execSync(`aws s3 sync s3://${S3_BUCKET}/builds/${platform}/${version}/ s3://${S3_BUCKET}/builds/${platform}/latest/ --delete`, { encoding: 'utf-8' });

            // Also update the root "latest" folder for backward compatibility
            if (platform === 'win') {
                execSync(`aws s3 sync s3://${S3_BUCKET}/builds/${platform}/latest/ s3://${S3_BUCKET}/latest/ --delete`, { encoding: 'utf-8' });
            }

            console.log(`Successfully updated latest for ${platform} to version ${version}`);
        } catch (error) {
            console.error(`Error updating latest for ${platform}:`, error);
        }
    }
}

function cleanOldVersions(keepCount: number) {
    if (!keepCount || isNaN(Number(keepCount)) || Number(keepCount) < 1) {
        console.error('Error: Keep count must be a positive number');
        printUsage();
        process.exit(1);
    }

    const keep = Number(keepCount);

    for (const platform of PLATFORMS) {
        console.log(`\nCleaning old versions for ${platform}, keeping the latest ${keep} versions...`);

        try {
            // List all versions in the platform directory
            const result = execSync(`aws s3 ls s3://${S3_BUCKET}/builds/${platform}/`, { encoding: 'utf-8' });

            // Parse the result and show versions
            const versions = result
                .split('\n')
                .filter(line => line.includes('PRE'))
                .map(line => {
                    const match = line.match(/PRE (.+)\//);
                    return match ? match[1] : null;
                })
                .filter(Boolean)
                .filter(v => v !== 'latest' && v !== 'dev');

            if (versions.length <= keep) {
                console.log(`Only ${versions.length} versions found, nothing to clean up`);
                continue;
            }

            // Sort versions (newest first)
            versions.sort((a, b) => {
                const verA = a!.split('.').map(Number);
                const verB = b!.split('.').map(Number);

                for (let i = 0; i < Math.max(verA.length, verB.length); i++) {
                    const numA = i < verA.length ? verA[i] : 0;
                    const numB = i < verB.length ? verB[i] : 0;

                    if (numA !== numB) {
                        return numB - numA;
                    }
                }

                return 0;
            });

            // Keep the first 'keep' versions, delete the rest
            const versionsToDelete = versions.slice(keep);

            console.log(`Keeping versions: ${versions.slice(0, keep).join(', ')}`);
            console.log(`Deleting versions: ${versionsToDelete.join(', ')}`);

            // Confirm before deletion
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question(`Are you sure you want to delete these versions? (y/N) `, (answer: string) => {
                readline.close();

                if (answer.toLowerCase() === 'y') {
                    for (const version of versionsToDelete) {
                        console.log(`Deleting ${platform}/${version}...`);
                        execSync(`aws s3 rm s3://${S3_BUCKET}/builds/${platform}/${version}/ --recursive`, { encoding: 'utf-8' });
                    }
                    console.log(`Successfully cleaned up old versions for ${platform}`);
                } else {
                    console.log('Deletion cancelled');
                }
            });
        } catch (error) {
            console.error(`Error cleaning old versions for ${platform}:`, error);
        }
    }
}

// Main script logic
switch (command) {
    case 'list':
        listVersions(args[1]);
        break;

    case 'update-latest':
        updateLatest(args[1]);
        break;

    case 'clean':
        cleanOldVersions(Number(args[1]));
        break;

    default:
        printUsage();
        break;
} 