#!/bin/bash
# Script to check notarization history
# Usage: ./notarization-history.sh

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Credentials from environment variables
APPLE_ID="${APPLE_ID:-}"
APPLE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

echo -e "${GREEN}=== Checking macOS App Notarization History ===${NC}"

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

echo -e "${GREEN}Fetching notarization history...${NC}"
xcrun notarytool history \
  --apple-id "${APPLE_ID}" \
  --password "${APPLE_PASSWORD}" \
  --team-id "${APPLE_TEAM_ID}"

echo -e "\n${GREEN}To get details about a specific submission, run:${NC}"
echo -e "xcrun notarytool info SUBMISSION_ID --apple-id \"${APPLE_ID}\" --password \"YOUR_PASSWORD\" --team-id \"${APPLE_TEAM_ID}\""

echo -e "\n${GREEN}To get the log for a specific submission, run:${NC}"
echo -e "xcrun notarytool log SUBMISSION_ID --apple-id \"${APPLE_ID}\" --password \"YOUR_PASSWORD\" --team-id \"${APPLE_TEAM_ID}\" notarization.log"

echo -e "\n${GREEN}Replace SUBMISSION_ID with the ID from the history output above.${NC}"
echo -e "${YELLOW}Note: You can also view your notarization history in the Apple Developer portal:${NC}"
echo -e "https://appstoreconnect.apple.com/access/users/developers" 