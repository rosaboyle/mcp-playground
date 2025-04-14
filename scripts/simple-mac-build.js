#!/usr/bin/env node

// Simple script to build macOS app with environment variables properly loaded
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const yaml = require('js-yaml');

// Load environment variables from .env file
dotenv.config();

// Ensure required variables are set
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || 'Q77V5GTU3Q';
console.log('Using Apple Team ID:', APPLE_TEAM_ID);

try {
    // Run npm build first
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Create a temporary electron builder config file that explicitly sets the team ID
    const tempConfigPath = path.join(__dirname, '../temp-electron-builder.yml');
    const electronBuilderConfigPath = path.join(__dirname, '../electron-builder.yml');

    // Read the existing config file as YAML
    const configContent = fs.readFileSync(electronBuilderConfigPath, 'utf8');
    const config = yaml.load(configContent);

    // Fix properties that cause issues
    if (config.mac && config.mac.extraEntitlements) {
        delete config.mac.extraEntitlements;

        // Add the entitlements as extendInfo instead, which is a valid property
        config.mac.extendInfo = config.mac.extendInfo || {};
        config.mac.extendInfo['com.apple.security.app-sandbox'] = true;
        config.mac.extendInfo['com.apple.security.files.all'] = true;
        config.mac.extendInfo['com.apple.security.automation.apple-events'] = true;
    }

    // Write the modified config to a temp file
    fs.writeFileSync(tempConfigPath, yaml.dump(config), 'utf8');

    console.log('Packaging for macOS...');

    // Use process.env to pass environment variables
    const env = {
        ...process.env,
        CSC_FOR_PULL_REQUEST: 'true',
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
        ELECTRON_TEAM_ID: APPLE_TEAM_ID,
        USE_HARD_LINKS: 'false',  // Avoid permission issues
        APPLE_NOTARIZE: 'false'   // Disable notarization for now
    };

    // Run electron-builder with the temporary config and specific flags to avoid DMG creation issues
    execSync(`npx electron-builder build --mac --config=${tempConfigPath} --dir`, {
        stdio: 'inherit',
        env: env
    });

    // Clean up the temporary config
    fs.unlinkSync(tempConfigPath);

    console.log('macOS build completed successfully in release/mac-arm64/');
} catch (error) {
    console.error('Build failed:', error.message);
    // Keep the temp file for debugging if it exists
    process.exit(1);
} 