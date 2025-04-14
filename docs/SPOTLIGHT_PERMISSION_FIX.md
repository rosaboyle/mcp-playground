# Fixing macOS Spotlight Permissions

## Problem

When using the application on macOS, you may encounter the following error:

```
The application "Spotlight" does not have permission to open "(null)."
```

This error occurs because macOS Spotlight requires specific entitlements to access and index your application's files.

## Solution

To fix this issue, we've added the following entitlements to the application:

1. `com.apple.security.app-sandbox`: Enables the macOS App Sandbox security feature
2. `com.apple.security.files.all`: Provides broader file access permissions
3. `com.apple.security.automation.apple-events`: Allows the app to send Apple Events

These entitlements have been added to:

- The application's entitlements file at `build/entitlements.mac.plist`
- All macOS build scripts in the `scripts/` directory
- GitHub Actions workflow files for CI/CD
- The `electron-builder.yml` configuration file

## Testing the Fix

After applying these changes:

1. Rebuild the application with:
   ```
   npm run build
   ```

2. Run the application in development mode:
   ```
   npm run dev
   ```

3. Package the application for macOS:
   ```
   npm run package:mac
   ```

Note: For proper code signing and notarization, you'll need a valid Apple Developer account and the appropriate certificates.

## For Developers

When making changes to the build process, ensure these entitlements are preserved in:

1. All entitlements.mac.plist files 
2. Build scripts that generate entitlements
3. CI/CD workflows

## References

- [Apple Developer Documentation on Entitlements](https://developer.apple.com/documentation/bundleresources/entitlements)
- [Electron Documentation on macOS Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [macOS App Sandbox Documentation](https://developer.apple.com/documentation/security/app_sandbox) 