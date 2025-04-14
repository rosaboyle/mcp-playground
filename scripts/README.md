# macOS Signing and Notarization Scripts

This directory contains scripts to help with code signing and notarizing macOS applications.

## Prerequisites

Before using these scripts, you'll need to have the following:

1. An Apple Developer Account
2. A Developer ID Application certificate installed in your keychain
3. An App-specific password for your Apple ID (for notarization)
4. Your Apple Developer Team ID

## macOS Code Signing and Notarization Script

The `macos-sign-notarize.sh` script automates the process of building, code signing, and notarizing your macOS application.

### Setup

1. Make the script executable:
   ```bash
   chmod +x scripts/macos-sign-notarize.sh
   ```

2. Set your Apple credentials as environment variables:
   ```bash
   export APPLE_ID=your.email@example.com
   export APPLE_APP_SPECIFIC_PASSWORD=your-app-specific-password
   export APPLE_TEAM_ID=your-team-id
   ```

   Note: You can find your Team ID in the [Apple Developer Portal](https://developer.apple.com/account/#/membership) under Membership details.

### Usage

Run the script from the project root directory:

```bash
./scripts/macos-sign-notarize.sh
```

#### Options

The script supports the following options:

- `--skip-build`: Skip the build step (useful if you've already built the app)
- `--skip-notarize`: Skip the notarization step (useful for testing)

Example:
```bash
./scripts/macos-sign-notarize.sh --skip-build
```

### What the Script Does

1. Creates necessary entitlements and hook files
2. Builds the application using electron-builder (unless --skip-build is used)
3. Verifies the code signature on the built app
4. Submits the DMG for notarization (unless --skip-notarize is used)
5. Fetches and displays the notarization log
6. Staples the notarization ticket to the DMG if successful

### Troubleshooting

If notarization fails, check the notarization log for details about the issues. Common problems include:

1. **Missing or invalid entitlements**: The script creates a standard set of entitlements, but your app might need additional ones.
2. **Unsigned binaries**: Check if all binaries in your app bundle are properly signed.
3. **Hardened Runtime issues**: Make sure your app is built with the hardened runtime enabled.

For more detailed information, see [Apple's documentation on notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution).

## Notes on Code Signing

For proper code signing to work, your Developer ID Application certificate must be installed in your keychain. The electron-builder tool will automatically find and use this certificate.

If you have multiple certificates, you may need to specify which one to use by setting the `CSC_NAME` environment variable:

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
``` 