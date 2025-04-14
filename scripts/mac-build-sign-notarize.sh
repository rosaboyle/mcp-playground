#!/bin/bash
# macOS Build, Sign, and Notarize Script
# This script handles the complete workflow for macOS builds

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

echo -e "${GREEN}Building and signing macOS app...${NC}"
# Run electron-builder with the proper environment variables
DEBUG=electron-builder npx electron-builder build --mac \
  --config.mac.hardenedRuntime=true \
  --config.mac.gatekeeperAssess=false \
  --config.mac.entitlements="${ENTITLEMENTS_PATH}" \
  --config.mac.entitlementsInherit="${ENTITLEMENTS_PATH}" \
  --config.mac.identity="Developer ID Application" \
  --config.afterSign="${BUILD_DIR}/afterSign.js"

# Find the generated app and DMG files
APP_PATH=$(find "${RELEASE_DIR}" -name "*.app" -type d | head -n 1)
DMG_FILE=$(find "${RELEASE_DIR}" -name "*.dmg" | head -n 1)

if [ -z "$APP_PATH" ]; then
  echo -e "${RED}Failed to find built app in ${RELEASE_DIR}${NC}"
  exit 1
fi

echo -e "${GREEN}App built successfully: ${APP_PATH}${NC}"

# Verify code signing
echo -e "${GREEN}Verifying code signature...${NC}"
codesign -vvv --deep --strict "${APP_PATH}" || {
  echo -e "${YELLOW}Code signature verification had some issues, but continuing...${NC}"
}

# Notarize the app
if [ -n "$DMG_FILE" ]; then
  echo -e "${GREEN}Found DMG file: ${DMG_FILE}${NC}"
  echo -e "${GREEN}Submitting for notarization...${NC}"
  
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
  echo -e "${YELLOW}No DMG file found. Skipping notarization.${NC}"
fi

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= Build and sign process completed =${NC}"
echo -e "${GREEN}==============================================${NC}" 