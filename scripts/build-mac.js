#!/usr/bin/env node

// Script to build macOS app with environment variables properly loaded
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Ensure required variables are set
const requiredVars = ['APPLE_TEAM_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please check your .env file and ensure these variables are set.');
    process.exit(1);
}

console.log('Building macOS app with Team ID:', process.env.APPLE_TEAM_ID);

try {
    // Run npm build first
    console.log('Building application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Run electron-builder with proper environment variables
    console.log('Packaging for macOS...');

    // Set up environment variables that electron-osx-sign will use
    const env = {
        ...process.env,
        CSC_FOR_PULL_REQUEST: 'true',
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',  // Don't auto-discover identity
        APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
        ELECTRON_NOTARIZE: 'false'  // Disable notarization for now
    };

    // Run the build command
    execSync('npx electron-builder build --mac', {
        stdio: 'inherit',
        env: env
    });

    console.log('macOS build completed successfully!');
} catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
} 