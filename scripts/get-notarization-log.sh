#!/bin/bash
# Script to get notarization log for a specific submission
# Usage: ./get-notarization-log.sh SUBMISSION_ID

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if submission ID was provided
if [ $# -ne 1 ]; then
  echo -e "${RED}Error: Submission ID is required.${NC}"
  echo -e "Usage: $0 SUBMISSION_ID"
  exit 1
fi

SUBMISSION_ID="$1"

# Source .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Credentials from environment variables
APPLE_ID="${APPLE_ID:-}"
APPLE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

# Check for required credentials
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo -e "${RED}Error: Missing Apple credentials. Please set them in your .env file:${NC}"
  [ -z "$APPLE_ID" ] && echo "  - APPLE_ID"
  [ -z "$APPLE_PASSWORD" ] && echo "  - APPLE_APP_SPECIFIC_PASSWORD"
  [ -z "$APPLE_TEAM_ID" ] && echo "  - APPLE_TEAM_ID"
  exit 1
fi

echo -e "${GREEN}=== Fetching Notarization Log ===${NC}"
echo -e "${GREEN}Submission ID: ${SUBMISSION_ID}${NC}"

# Create logs directory if it doesn't exist
mkdir -p logs

# Unique log filename with timestamp
LOG_FILENAME="logs/notarization-${SUBMISSION_ID}-$(date +%Y%m%d-%H%M%S).log"

echo -e "${GREEN}Fetching detailed notarization log...${NC}"
xcrun notarytool log "${SUBMISSION_ID}" \
  --apple-id "${APPLE_ID}" \
  --password "${APPLE_PASSWORD}" \
  --team-id "${APPLE_TEAM_ID}" \
  "${LOG_FILENAME}"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully retrieved notarization log${NC}"
  echo -e "${GREEN}Log saved to: ${LOG_FILENAME}${NC}"
  
  echo -e "${GREEN}======================== NOTARIZATION LOG ========================${NC}"
  cat "${LOG_FILENAME}"
  echo -e "${GREEN}==============================================================${NC}"
  
  # Also get info about the submission
  echo -e "${GREEN}Fetching submission details...${NC}"
  INFO_FILENAME="logs/info-${SUBMISSION_ID}-$(date +%Y%m%d-%H%M%S).json"
  
  xcrun notarytool info "${SUBMISSION_ID}" \
    --apple-id "${APPLE_ID}" \
    --password "${APPLE_PASSWORD}" \
    --team-id "${APPLE_TEAM_ID}" \
    --output-format json > "${INFO_FILENAME}"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully retrieved submission info${NC}"
    echo -e "${GREEN}Info saved to: ${INFO_FILENAME}${NC}"
    
    echo -e "${GREEN}======================== SUBMISSION INFO ========================${NC}"
    cat "${INFO_FILENAME}"
    echo -e "${GREEN}================================================================${NC}"
  else
    echo -e "${RED}❌ Failed to retrieve submission info${NC}"
  fi
else
  echo -e "${RED}❌ Failed to retrieve notarization log${NC}"
fi 