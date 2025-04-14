# macOS App Signing and Notarization Guide

This guide explains how to sign and notarize your Electron app for macOS distribution.

## Where Your Signed App is Stored

When you build and sign your Electron app with electron-builder, the signed files are stored in specific locations:

1. **The .app bundle** - Located in: 
   ```
   ./release/mac-arm64/TRMX Agent.app     # For Apple Silicon builds
   ./release/mac/TRMX Agent.app           # For Intel builds
   ```

2. **The DMG installer** - Located in:
   ```
   ./release/TRMX Agent-[version]-arm64.dmg  # For Apple Silicon builds
   ./release/TRMX Agent-[version].dmg        # For Intel builds
   ```

3. **Other distribution formats** (ZIP, etc.) - Located in the `./release` directory

## Code Signing Process

Code signing is typically done during the build process using electron-builder. This involves:

1. **Preparing your certificate** - You need a Developer ID Application certificate from Apple
2. **Building the app** - Using electron-builder with code signing enabled
3. **Signing the app bundle** - electron-builder signs the .app and all its contents

## Notarization Process

Notarization is a separate step that happens after signing:

1. **Upload to Apple** - The signed .app or .dmg is uploaded to Apple's notary service
2. **Verification** - Apple verifies the app meets security requirements
3. **Stapling** - The notarization ticket is "stapled" to your app

## Using the Scripts

We provide two scripts:

### 1. Full Build, Sign and Notarize (`./scripts/macos-sign-notarize.sh`)

This script handles the entire process:
- Building the app with webpack
- Code signing with electron-builder
- Notarizing with Apple's service
- Stapling the notarization ticket

### 2. Notarize Only (`./scripts/notarize-app.sh`)

If your app is already built and signed, you can use this script to just notarize it:

```bash
./scripts/notarize-app.sh [path/to/your.dmg]
```

If you don't specify a DMG path, it will try to find one in the `./release` directory.

## Setting Up Credentials

Both scripts require Apple Developer credentials. You can set them in a `.env` file (copy from `.env.example`):

```
APPLE_ID=your.email@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=ABCDE12345
```

Or set them as environment variables:

```bash
export APPLE_ID="your.email@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABCDE12345"
```

## Certificate Management

For code signing to work, you need a Developer ID Application certificate installed in your keychain.

1. **Getting a certificate**:
   - Sign in to [Apple Developer Program](https://developer.apple.com/account/resources/certificates/list)
   - Create a "Developer ID Application" certificate
   - Download and install it to your Mac's keychain

2. **Using the certificate**:
   - electron-builder will automatically find and use it
   - If you have multiple certificates, specify which one to use:
     ```
     export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
     ```

## Verifying Your App

After the process is complete, you can verify that your app is properly signed and notarized:

```bash
# Verify code signature
codesign -vvv --deep --strict "path/to/Your.app"

# Verify notarization stapling
spctl --assess -vv "path/to/Your.app"
```

## Checking Notarization History and Failed Attempts

To check your notarization history and investigate failed attempts:

1. **Using our notarization history script**:
   ```bash
   ./scripts/notarization-history.sh
   ```
   This will show your recent notarization submissions with their status.

   Note: You need to set your Apple credentials as environment variables first:
   ```bash
   export APPLE_ID="your.email@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
   export APPLE_TEAM_ID="your-team-id"
   ```

2. **Using Apple Developer Portal**:
   - Go to [App Store Connect](https://appstoreconnect.apple.com/)
   - Navigate to Users and Access > Developers
   - Click on your name
   - Select the "Notarization" tab

3. **Investigating specific failures**:
   When you have a submission ID from a failed attempt, you can get detailed logs:
   ```bash
   xcrun notarytool log SUBMISSION_ID \
     --apple-id "your@email.com" \
     --password "app-specific-password" \
     --team-id "TEAMID" \
     notarization.log
   ```

4. **Common notarization failures**:
   - **Missing entitlements**: Make sure your app has the required entitlements
   - **Unsigned components**: All executable code must be signed
   - **Hardened runtime issues**: Check your app is built with hardened runtime enabled
   - **Library validation**: Third-party libraries must comply with Apple's requirements

The `notarization.log` file will contain detailed information about what specifically failed in your notarization attempt, making it easier to diagnose and fix the issues.

## Publishing to S3

After successfully notarizing your macOS application, you can publish it to an S3 bucket for distribution. We provide a script to help with this process.

### Setting Up S3 Publishing

1. **Configure AWS Credentials**:
   Make sure you have the AWS CLI installed and configured with the necessary credentials.
   ```bash
   aws configure
   ```

2. **Customize S3 Settings** (Optional):
   Copy the example configuration file and edit it with your bucket details:
   ```bash
   cp .env.s3.example .env.s3
   ```
   Then edit `.env.s3` to set your S3 bucket name and other preferences.

### Publishing Your App

To publish your notarized DMG to S3:

```bash
./scripts/upload-to-s3.sh
```

This will:
1. Find the latest DMG file in your `release` directory
2. Upload it to three locations in your S3 bucket:
   - `releases/macos/[version]/TRMX Agent-[version]-arm64.dmg` (versioned, permanent)
   - `releases/macos/latest/TRMX Agent-[version]-arm64.dmg` (latest version)
   - `releases/macos/latest-[major.minor]/TRMX Agent-[version]-arm64.dmg` (latest patch in this minor version)

### Custom Upload Options

You can specify a custom bucket name and file:

```bash
./scripts/upload-to-s3.sh my-custom-bucket path/to/my-app.dmg
```

### S3 URL Structure

After uploading, your app will be available at:

- Versioned URL: `https://[bucket].s3.amazonaws.com/releases/macos/[version]/TRMX Agent-[version]-arm64.dmg`
- Latest URL: `https://[bucket].s3.amazonaws.com/releases/macos/latest/TRMX Agent-[version]-arm64.dmg`
- Latest Minor Version URL: `https://[bucket].s3.amazonaws.com/releases/macos/latest-[major.minor]/TRMX Agent-[version]-arm64.dmg`

This structure allows you to:
- Link users to specific versions
- Always provide the latest version
- Ensure users on a specific minor version get the latest patches

## Reference Links

- [Apple's Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Electron Builder Code Signing](https://www.electron.build/code-signing)
- [Troubleshooting Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution/resolving_common_notarization_issues) 