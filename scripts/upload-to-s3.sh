#!/bin/bash
# Simple script to upload DMG files to S3
# Usage: ./upload-to-s3.sh [path/to/file.dmg]

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default settings
S3_BUCKET="mcpx"
DMG_FILE="${1:-}"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

# If no file is specified, try to find the latest DMG in the release directory
if [ -z "$DMG_FILE" ]; then
  echo -e "${YELLOW}No file specified. Looking for the latest DMG in the release directory...${NC}"
  DMG_FILE=$(find release -name "*.dmg" | sort -r | head -n 1)
  
  if [ -z "$DMG_FILE" ]; then
    echo -e "${RED}Error: No DMG file found. Please specify the path to the DMG file.${NC}"
    echo -e "Usage: $0 [path/to/file.dmg]"
    exit 1
  fi
fi

# Check if file exists
if [ ! -f "$DMG_FILE" ]; then
  echo -e "${RED}Error: File not found: $DMG_FILE${NC}"
  exit 1
fi

# Get the file name from the path and standardize it
FILE_NAME=$(basename "$DMG_FILE")
STANDARD_NAME=$(echo "$FILE_NAME" | sed 's/ /-/g')

# Set S3 destination paths
S3_VERSIONED_PATH="releases/macos/${VERSION}/${STANDARD_NAME}"
S3_LATEST_PATH="releases/macos/latest/${STANDARD_NAME}"

echo -e "${GREEN}=== Uploading DMG to S3 ===${NC}"
echo -e "${GREEN}File: ${DMG_FILE}${NC}"
echo -e "${GREEN}Size: $(du -h "$DMG_FILE" | cut -f1)${NC}"
echo -e "${GREEN}Version: ${VERSION}${NC}"
echo -e "${GREEN}S3 Bucket: ${S3_BUCKET}${NC}"

# Check if AWS credentials are available
aws sts get-caller-identity &> /dev/null
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: AWS credentials not found or not valid.${NC}"
  echo -e "${YELLOW}Make sure you have configured AWS CLI with valid credentials.${NC}"
  exit 1
fi

# Upload to versioned path
echo -e "${GREEN}Uploading to versioned location...${NC}"
aws s3 cp "${DMG_FILE}" "s3://${S3_BUCKET}/${S3_VERSIONED_PATH}"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully uploaded to versioned location${NC}"
else
  echo -e "${RED}❌ Failed to upload to versioned location${NC}"
  exit 1
fi

# Upload to latest path
echo -e "${GREEN}Uploading to latest location...${NC}"
aws s3 cp "${DMG_FILE}" "s3://${S3_BUCKET}/${S3_LATEST_PATH}"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Successfully uploaded to latest location${NC}"
  echo -e "${GREEN}=== Upload Complete ===${NC}"
  echo -e "${GREEN}Versioned URL: https://${S3_BUCKET}.s3.amazonaws.com/${S3_VERSIONED_PATH}${NC}"
  echo -e "${GREEN}Latest URL: https://${S3_BUCKET}.s3.amazonaws.com/${S3_LATEST_PATH}${NC}"
else
  echo -e "${RED}❌ Failed to upload to latest location${NC}"
fi 