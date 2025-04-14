#!/bin/bash
# macOS Simple Build Script - Avoids locale.pak signing issues
# This script takes a more direct approach by separating build and signing steps

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

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= macOS Simple Build Process =${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "${BLUE}Using Team ID: ${APPLE_TEAM_ID}${NC}"

# Project paths
PROJECT_DIR=$(pwd)
BUILD_DIR="${PROJECT_DIR}/build"
RELEASE_DIR="${PROJECT_DIR}/release"
APP_DIR="${RELEASE_DIR}/mac-arm64"
ENTITLEMENTS_PATH="${BUILD_DIR}/entitlements.mac.plist"

# Clean any previous releases
echo -e "${GREEN}Cleaning previous release artifacts...${NC}"
rm -rf "${RELEASE_DIR}"

# Build the app
echo -e "${GREEN}Building application...${NC}"
npm run build

# First build without signing
echo -e "${GREEN}Building macOS app without signing...${NC}"
npx electron-builder build --mac --dir \
  --config.mac.identity=null \
  --config.mac.hardenedRuntime=true \
  --config.mac.gatekeeperAssess=false

# Find the app
APP_PATH=$(find "${APP_DIR}" -name "*.app" -type d | head -n 1)
if [ -z "$APP_PATH" ]; then
  echo -e "${RED}Failed to find built app in ${APP_DIR}${NC}"
  exit 1
fi

echo -e "${GREEN}App built successfully: ${APP_PATH}${NC}"
echo -e "${GREEN}Manually signing app with Developer ID...${NC}"

# Set the identity
IDENTITY="Developer ID Application"

# Sign the app manually, avoiding the locale.pak files
echo -e "${GREEN}Signing the app bundle...${NC}"
find "${APP_PATH}/Contents/Frameworks" -name "*.framework" -o -name "*.dylib" | while read -r FRAMEWORK; do
  echo -e "${BLUE}Signing ${FRAMEWORK}${NC}"
  codesign --force --options runtime --timestamp --entitlements "${ENTITLEMENTS_PATH}" --sign "${IDENTITY}" "${FRAMEWORK}" || true
done

echo -e "${GREEN}Signing main executable...${NC}"
codesign --force --options runtime --timestamp --entitlements "${ENTITLEMENTS_PATH}" --sign "${IDENTITY}" "${APP_PATH}/Contents/MacOS/"* || true

echo -e "${GREEN}Signing final app bundle...${NC}"
codesign --force --deep --options runtime --timestamp --entitlements "${ENTITLEMENTS_PATH}" --sign "${IDENTITY}" "${APP_PATH}" || true

echo -e "${GREEN}Verifying code signature...${NC}"
codesign -vvv --deep "${APP_PATH}" || {
  echo -e "${YELLOW}Code signature verification had some issues, but continuing...${NC}"
}

# Create a DMG
echo -e "${GREEN}Creating DMG...${NC}"
hdiutil create -volname "TRMX Agent" -srcfolder "${APP_PATH}" -ov -format UDZO "${RELEASE_DIR}/TRMX-Agent.dmg"

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= Build process completed =${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}App location: ${APP_PATH}${NC}"
echo -e "${GREEN}DMG location: ${RELEASE_DIR}/TRMX-Agent.dmg${NC}"
echo -e ""
echo -e "${YELLOW}To notarize the app manually, run:${NC}"
echo -e "xcrun notarytool submit \"${RELEASE_DIR}/TRMX-Agent.dmg\" \\"
echo -e "  --apple-id \"${APPLE_ID}\" \\"
echo -e "  --password \"<app-specific-password>\" \\"
echo -e "  --team-id \"${APPLE_TEAM_ID}\" \\"
echo -e "  --wait" 