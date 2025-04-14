#!/bin/bash
# macOS Build, Sign, and Notarize Script with Squirrel.framework Fix
# This script handles the complete workflow for macOS builds and fixes notarization issues with ShipIt

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load .env file
if [ -f .env ]; then
  echo -e "${GREEN}Loading environment variables from .env file...${NC}"
  export $(grep -v '^#' .env | xargs)
else
  echo -e "${RED}No .env file found. Make sure it exists in the current directory.${NC}"
  exit 1
fi

# Verify required environment variables
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo -e "${RED}Missing required environment variables. Please check your .env file.${NC}"
  echo -e "${YELLOW}Required variables:${NC}"
  echo -e "  - APPLE_ID"
  echo -e "  - APPLE_APP_SPECIFIC_PASSWORD"
  echo -e "  - APPLE_TEAM_ID"
  exit 1
fi

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= macOS Build, Sign, and Notarize Process =${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "${BLUE}Using Apple ID: ${APPLE_ID}${NC}"
echo -e "${BLUE}Using Team ID: ${APPLE_TEAM_ID}${NC}"

# Project paths
PROJECT_DIR=$(pwd)
BUILD_DIR="${PROJECT_DIR}/build"
RELEASE_DIR="${PROJECT_DIR}/release"
ENTITLEMENTS_PATH="${BUILD_DIR}/entitlements.mac.plist"
LOGS_DIR="${PROJECT_DIR}/logs"

# Create necessary directories
mkdir -p "${LOGS_DIR}"

# Get the app ID and version from package.json
APP_ID=$(grep -o '"appId": *"[^"]*"' package.json | cut -d'"' -f4 || echo "com.airtrain.trmx-agent")
APP_VERSION=$(grep -o '"version": *"[^"]*"' package.json | cut -d'"' -f4 || echo "0.1.0")
PRODUCT_NAME=$(grep -o '"productName": *"[^"]*"' package.json | cut -d'"' -f4 || echo "TRMX Agent")

echo -e "${GREEN}Using App ID: ${APP_ID}${NC}"
echo -e "${GREEN}Using App Version: ${APP_VERSION}${NC}"
echo -e "${GREEN}Using Product Name: ${PRODUCT_NAME}${NC}"

# Create or modify Info.plist to include ElectronTeamID
INFO_PLIST_DIR="${BUILD_DIR}"
mkdir -p "${INFO_PLIST_DIR}"
INFO_PLIST="${INFO_PLIST_DIR}/Info.plist"

echo -e "${GREEN}Creating Info.plist with ElectronTeamID...${NC}"
cat > "${INFO_PLIST}" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ElectronTeamID</key>
  <string>${APPLE_TEAM_ID}</string>
  <key>CFBundleIdentifier</key>
  <string>${APP_ID}</string>
  <key>CFBundleVersion</key>
  <string>${APP_VERSION}</string>
  <key>CFBundleShortVersionString</key>
  <string>${APP_VERSION}</string>
</dict>
</plist>
EOF

echo -e "${GREEN}Created Info.plist with ElectronTeamID: ${APPLE_TEAM_ID}${NC}"

# Create temporary electron-builder configuration
TEMP_CONFIG_DIR=$(mktemp -d)
TEMP_CONFIG_FILE="${TEMP_CONFIG_DIR}/electron-builder-config.json"

echo -e "${GREEN}Creating temporary electron-builder configuration...${NC}"
cat > "${TEMP_CONFIG_FILE}" << EOF
{
  "appId": "${APP_ID}",
  "productName": "${PRODUCT_NAME}",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "mac": {
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "${ENTITLEMENTS_PATH}",
    "entitlementsInherit": "${ENTITLEMENTS_PATH}",
    "identity": "Developer ID Application",
    "extendInfo": {
      "ElectronTeamID": "${APPLE_TEAM_ID}",
      "CFBundleIdentifier": "${APP_ID}",
      "CFBundleVersion": "${APP_VERSION}",
      "CFBundleShortVersionString": "${APP_VERSION}"
    },
    "preAutoEntitlements": false,
    "target": ["dmg", "zip"],
    "notarize": {
      "teamId": "${APPLE_TEAM_ID}"
    }
  },
  "afterSign": "${BUILD_DIR}/afterSign.js",
  "files": ["dist/**/*", "package.json"]
}
EOF

# Build the app
echo -e "${GREEN}Building application...${NC}"
npm run build

# Clean any previous releases to avoid conflicts
echo -e "${GREEN}Cleaning previous release artifacts...${NC}"
rm -rf "${RELEASE_DIR}"

# Set environment variables for signing
export CSC_FOR_PULL_REQUEST=true
export CSC_IDENTITY_AUTO_DISCOVERY=false
export ELECTRON_TEAM_ID="${APPLE_TEAM_ID}"
# Add this to disable automatic signing of locale.pak files
export CSC_IDENTITY_SIGN_FILES="!locale.pak"
# Explicitly set preAutoEntitlements to false
export PRE_AUTO_ENTITLEMENTS=false
# Set environment variables for notarization
export APPLE_ID="${APPLE_ID}"
export APPLE_APP_SPECIFIC_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD}"
export APPLE_TEAM_ID="${APPLE_TEAM_ID}"

echo -e "${GREEN}Building and signing macOS app...${NC}"
# Run electron-builder with the proper environment variables and configuration file
DEBUG=electron-builder npx electron-builder build --mac \
  --config="${TEMP_CONFIG_FILE}"

# Find the generated app and DMG files - check both directly in release and in release/mac-arm64 or release/mac
APP_PATH=$(find "${RELEASE_DIR}" -name "*.app" -type d | head -n 1)
if [ -z "$APP_PATH" ]; then
    APP_PATH=$(find "${RELEASE_DIR}/mac-arm64" -name "*.app" -type d 2>/dev/null | head -n 1)
fi
if [ -z "$APP_PATH" ]; then
    APP_PATH=$(find "${RELEASE_DIR}/mac" -name "*.app" -type d 2>/dev/null | head -n 1)
fi

DMG_FILE=$(find "${RELEASE_DIR}" -name "*.dmg" | head -n 1)
if [ -z "$DMG_FILE" ]; then
    DMG_FILE=$(find "${RELEASE_DIR}/mac-arm64" -name "*.dmg" 2>/dev/null | head -n 1)
fi
if [ -z "$DMG_FILE" ]; then
    DMG_FILE=$(find "${RELEASE_DIR}/mac" -name "*.dmg" 2>/dev/null | head -n 1)
fi

if [ -z "$APP_PATH" ]; then
  echo -e "${RED}Failed to find built app in ${RELEASE_DIR} or subdirectories${NC}"
  exit 1
fi

echo -e "${GREEN}App built successfully: ${APP_PATH}${NC}"

# ========== FIX SQUIRREL FRAMEWORK SIGNING ISSUES ==========
echo -e "${GREEN}Fixing Squirrel.framework signing issues...${NC}"

# Locate the Squirrel.framework and ShipIt binary
SQUIRREL_FRAMEWORK="${APP_PATH}/Contents/Frameworks/Squirrel.framework"
SHIPIT_BINARY="${SQUIRREL_FRAMEWORK}/Versions/A/Resources/ShipIt"

if [ -f "${SHIPIT_BINARY}" ]; then
  echo -e "${GREEN}Found ShipIt binary at: ${SHIPIT_BINARY}${NC}"
  
  # Remove existing signature (if any)
  echo -e "${YELLOW}Removing any existing signatures...${NC}"
  codesign --remove-signature "${SHIPIT_BINARY}" || true
  
  # Sign the ShipIt binary with hardened runtime and entitlements
  echo -e "${GREEN}Signing ShipIt binary with hardened runtime and entitlements...${NC}"
  codesign --force --options runtime --timestamp --sign "Developer ID Application: ${APPLE_TEAM_ID}" \
    --entitlements "${ENTITLEMENTS_PATH}" "${SHIPIT_BINARY}"
  
  # Sign the Squirrel.framework itself
  echo -e "${GREEN}Signing Squirrel.framework...${NC}"
  codesign --force --options runtime --timestamp --sign "Developer ID Application: ${APPLE_TEAM_ID}" \
    --entitlements "${ENTITLEMENTS_PATH}" --deep "${SQUIRREL_FRAMEWORK}"
  
  echo -e "${GREEN}Completed signing Squirrel.framework and ShipIt binary${NC}"
else
  echo -e "${YELLOW}ShipIt binary not found at expected location. Continuing anyway...${NC}"
fi

# Recursively sign all frameworks with hardened runtime
echo -e "${GREEN}Recursively signing all frameworks...${NC}"
find "${APP_PATH}/Contents/Frameworks" -type f -name "*.framework" -o -name "*.dylib" -o -path "*/Versions/*/Helpers/*" | while read -r framework; do
  echo -e "${BLUE}Signing: ${framework}${NC}"
  codesign --force --options runtime --timestamp --sign "Developer ID Application: ${APPLE_TEAM_ID}" \
    --entitlements "${ENTITLEMENTS_PATH}" "${framework}" || true
done

# Re-sign the main app bundle
echo -e "${GREEN}Re-signing the main app bundle...${NC}"
codesign --force --options runtime --timestamp --sign "Developer ID Application: ${APPLE_TEAM_ID}" \
  --entitlements "${ENTITLEMENTS_PATH}" --deep "${APP_PATH}"

# Verify code signing
echo -e "${GREEN}Verifying code signature...${NC}"
codesign -vvv --deep --strict "${APP_PATH}" || {
  echo -e "${YELLOW}Code signature verification had some issues, but continuing...${NC}"
}

# Verify specific ShipIt binary signing
if [ -f "${SHIPIT_BINARY}" ]; then
  echo -e "${GREEN}Verifying ShipIt binary signature...${NC}"
  codesign -vvv --deep --strict "${SHIPIT_BINARY}" || {
    echo -e "${RED}ShipIt binary signature verification failed. This may cause notarization issues.${NC}"
  }
fi

# If electron-builder's automatic notarization fails, we'll manually notarize the DMG
if [ -n "${DMG_FILE}" ]; then
  echo -e "${GREEN}Found DMG file: ${DMG_FILE}${NC}"
  echo -e "${GREEN}Manually notarizing DMG file...${NC}"
  
  # Generate a timestamp for log file
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  LOG_FILE="${LOGS_DIR}/notarization-${TIMESTAMP}.log"
  
  # Submit for notarization
  echo -e "${YELLOW}This may take several minutes...${NC}"
  xcrun notarytool submit "${DMG_FILE}" \
    --apple-id "${APPLE_ID}" \
    --password "${APPLE_APP_SPECIFIC_PASSWORD}" \
    --team-id "${APPLE_TEAM_ID}" \
    --wait | tee "${LOG_FILE}"
  
  # Extract submission ID from log
  SUBMISSION_ID=$(cat "${LOG_FILE}" | grep -o '"id": *"[^"]*"' | head -n 1 | grep -o '"[^"]*"$' | tr -d '"')
  
  if [ -n "$SUBMISSION_ID" ]; then
    echo -e "${GREEN}Fetching detailed notarization log...${NC}"
    NOTARIZATION_LOG="${LOGS_DIR}/notarization-details-${SUBMISSION_ID}-${TIMESTAMP}.log"
    
    xcrun notarytool log "${SUBMISSION_ID}" \
      --apple-id "${APPLE_ID}" \
      --password "${APPLE_APP_SPECIFIC_PASSWORD}" \
      --team-id "${APPLE_TEAM_ID}" > "${NOTARIZATION_LOG}"
    
    # Check notarization status
    NOTARIZATION_STATUS=$(xcrun notarytool info "${SUBMISSION_ID}" \
      --apple-id "${APPLE_ID}" \
      --password "${APPLE_APP_SPECIFIC_PASSWORD}" \
      --team-id "${APPLE_TEAM_ID}" | grep -o '"status": "[^"]*"' | cut -d'"' -f4)
    
    if [ "$NOTARIZATION_STATUS" = "Accepted" ]; then
      echo -e "${GREEN}Notarization successful! Stapling ticket to DMG...${NC}"
      xcrun stapler staple "${DMG_FILE}"
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Stapling completed successfully.${NC}"
        echo -e "${GREEN}Your app is ready for distribution: ${DMG_FILE}${NC}"
      else
        echo -e "${RED}❌ Stapling failed.${NC}"
      fi
    else
      echo -e "${RED}Notarization failed with status: ${NOTARIZATION_STATUS}${NC}"
      echo -e "${RED}Check the log for details: ${NOTARIZATION_LOG}${NC}"
    fi
  else
    echo -e "${RED}Failed to get submission ID. Notarization may have failed.${NC}"
  fi
else
  echo -e "${YELLOW}No DMG file found. Skipping manual notarization.${NC}"
fi

# Clean up temporary files
rm -rf "${TEMP_CONFIG_DIR}"

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= Build and sign process completed =${NC}"
echo -e "${GREEN}==============================================${NC}" 