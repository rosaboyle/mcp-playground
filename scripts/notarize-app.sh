#!/bin/bash
# macOS App Notarization Script
# This script notarizes an already signed macOS app
# Usage: ./notarize-app.sh [path/to/app.dmg]

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default paths
PROJECT_DIR=$(pwd)
RELEASE_DIR="${PROJECT_DIR}/release"

# Credentials from environment variables
APPLE_ID="${APPLE_ID:-}"
APPLE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

echo "APPLE_ID: $APPLE_ID"
echo "APPLE_PASSWORD: $APPLE_PASSWORD"
echo "APPLE_TEAM_ID: $APPLE_TEAM_ID"

# Check if a DMG file was provided as an argument
if [ $# -eq 1 ]; then
  DMG_FILE="$1"
  # Check if the file exists
  if [ ! -f "$DMG_FILE" ]; then
    echo -e "${RED}Error: File not found: $DMG_FILE${NC}"
    exit 1
  fi
else
  # Try to find a DMG file in the release directory
  DMG_FILE=$(find "${RELEASE_DIR}" -name "*.dmg" | head -n 1)
  
  if [ -z "$DMG_FILE" ]; then
    echo -e "${RED}Error: No DMG file found. Please specify a DMG file path.${NC}"
    echo -e "Usage: $0 [path/to/app.dmg]"
    exit 1
  fi
fi

echo -e "${GREEN}=== macOS App Notarization ===${NC}"
echo -e "${GREEN}DMG file: ${DMG_FILE}${NC}"

# Check for required credentials
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo -e "${RED}Error: Missing Apple credentials. Please set the following environment variables:${NC}"
  [ -z "$APPLE_ID" ] && echo "  - APPLE_ID"
  [ -z "$APPLE_PASSWORD" ] && echo "  - APPLE_APP_SPECIFIC_PASSWORD"
  [ -z "$APPLE_TEAM_ID" ] && echo "  - APPLE_TEAM_ID"
  
  echo -e "\n${YELLOW}You can set them temporarily with:${NC}"
  echo "export APPLE_ID=your.email@example.com"
  echo "export APPLE_APP_SPECIFIC_PASSWORD=your-app-specific-password"
  echo "export APPLE_TEAM_ID=your-team-id"
  exit 1
fi

# Create a temporary file for the submission output
SUBMIT_OUTPUT_FILE=$(mktemp)

echo -e "${GREEN}Submitting app for notarization...${NC}"
xcrun notarytool submit "${DMG_FILE}" \
  --apple-id "${APPLE_ID}" \
  --password "${APPLE_PASSWORD}" \
  --team-id "${APPLE_TEAM_ID}" \
  --wait \
  --output-format json > "${SUBMIT_OUTPUT_FILE}" 2>&1

# Print the output for debugging
echo -e "${GREEN}======================== NOTARIZATION SUBMISSION OUTPUT ========================${NC}"
cat "${SUBMIT_OUTPUT_FILE}"
echo -e "${GREEN}==============================================================================${NC}"

# Extract submission ID if available
SUBMISSION_ID=$(cat "${SUBMIT_OUTPUT_FILE}" | grep -o '"id": "[^"]*"' | cut -d'"' -f4)

if [ -n "$SUBMISSION_ID" ]; then
  echo -e "${GREEN}Successfully got submission ID: ${SUBMISSION_ID}${NC}"
  
  # Fetch detailed notarization log
  echo -e "${GREEN}Fetching detailed notarization log...${NC}"
  xcrun notarytool log "${SUBMISSION_ID}" \
    --apple-id "${APPLE_ID}" \
    --password "${APPLE_PASSWORD}" \
    --team-id "${APPLE_TEAM_ID}" \
    notarization.log
  
  echo -e "${GREEN}======================== NOTARIZATION LOG ========================${NC}"
  cat notarization.log
  echo -e "${GREEN}==============================================================${NC}"
  
  # Check notarization status
  NOTARIZATION_STATUS=$(xcrun notarytool info "${SUBMISSION_ID}" \
    --apple-id "${APPLE_ID}" \
    --password "${APPLE_PASSWORD}" \
    --team-id "${APPLE_TEAM_ID}" \
    --output-format json | grep -o '"status": "[^"]*"' | cut -d'"' -f4)
  
  if [ "$NOTARIZATION_STATUS" = "Accepted" ]; then
    echo -e "${GREEN}Notarization successful! Stapling ticket to application...${NC}"
    xcrun stapler staple "${DMG_FILE}"
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✅ Stapling completed successfully.${NC}"
    else
      echo -e "${RED}❌ Stapling failed.${NC}"
    fi
  else
    echo -e "${RED}Notarization failed with status: ${NOTARIZATION_STATUS}${NC}"
  fi
else
  echo -e "${RED}Failed to get submission ID. Notarization failed.${NC}"
  echo -e "${RED}Check the submission output above for more details.${NC}"
fi

# Clean up temporary file
rm -f "${SUBMIT_OUTPUT_FILE}"

echo -e "${GREEN}=== Notarization Process Complete ===${NC}"
if [ -n "$SUBMISSION_ID" ] && [ "$NOTARIZATION_STATUS" = "Accepted" ]; then
  echo -e "${GREEN}Notarization: ✅ Successful${NC}"
  echo -e "${GREEN}Notarized DMG: ${DMG_FILE}${NC}"
else
  echo -e "${RED}Notarization: ❌ Failed${NC}"
fi 