#!/bin/bash
# macOS x86_64 (Intel) Build, Sign, Notarize and Publish Script
# This script handles the complete workflow for Intel Mac builds

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default settings
S3_BUCKET="mcpx"
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
SKIP_NOTARIZE=false
SKIP_PUBLISH=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-notarize)
      SKIP_NOTARIZE=true
      shift
      ;;
    --skip-publish)
      SKIP_PUBLISH=true
      shift
      ;;
  esac
done

# Credentials from environment variables or .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

APPLE_ID="${APPLE_ID:-}"
APPLE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

# Project paths
PROJECT_DIR=$(pwd)
BUILD_DIR="${PROJECT_DIR}/build"
RELEASE_DIR="${PROJECT_DIR}/release"
ENTITLEMENTS_PATH="${BUILD_DIR}/entitlements.mac.plist"
AFTERSCRIPT_PATH="${BUILD_DIR}/afterSign.js"

# Create necessary directories
mkdir -p "${BUILD_DIR}"

echo -e "${GREEN}=== macOS x86_64 (Intel) Build, Sign, Notarize and Publish ===${NC}"
echo -e "${GREEN}Version: ${VERSION}${NC}"

# Create entitlements file
echo -e "${GREEN}Creating entitlements file...${NC}"
cat > "${ENTITLEMENTS_PATH}" << EOL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.security.cs.debugger</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.files.downloads.read-write</key>
  <true/>
  <key>com.apple.security.inherit</key>
  <true/>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.files.all</key>
  <true/>
  <key>com.apple.security.automation.apple-events</key>
  <true/>
</dict>
</plist>
EOL

# Create afterSign.js
echo -e "${GREEN}Creating afterSign.js...${NC}"
cat > "${AFTERSCRIPT_PATH}" << EOL
// This is a placeholder for the afterSign hook
// The real notarization happens after the build using xcrun notarytool
exports.default = async function() {
  console.log('Skipping automatic notarization in afterSign hook');
  return;
};
EOL

# Check for required signing credentials if notarization is enabled
if [ "$SKIP_NOTARIZE" = false ]; then
  if [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${YELLOW}Warning: Missing Apple credentials. Please set the following environment variables:${NC}"
    [ -z "$APPLE_ID" ] && echo "  - APPLE_ID"
    [ -z "$APPLE_PASSWORD" ] && echo "  - APPLE_APP_SPECIFIC_PASSWORD"
    [ -z "$APPLE_TEAM_ID" ] && echo "  - APPLE_TEAM_ID"
    
    echo -e "\n${YELLOW}You can set them temporarily with:${NC}"
    echo "export APPLE_ID=your.email@example.com"
    echo "export APPLE_APP_SPECIFIC_PASSWORD=your-app-specific-password"
    echo "export APPLE_TEAM_ID=your-team-id"
    
    echo -e "\n${YELLOW}Proceeding without notarization. Use --skip-notarize to suppress this warning.${NC}"
    SKIP_NOTARIZE=true
  fi
fi

# Build the application
echo -e "${GREEN}Running webpack build...${NC}"
npm run build

echo -e "${GREEN}Building macOS x64 (Intel) app with electron-builder...${NC}"
# Set environment variables for code signing
export CSC_FOR_PULL_REQUEST=true
export CSC_IDENTITY_AUTO_DISCOVERY=false
export ELECTRON_TEAM_ID="${APPLE_TEAM_ID}"

echo -e "${GREEN}Using Team ID: ${ELECTRON_TEAM_ID}${NC}"

# Run electron-builder with x64 architecture flag
DEBUG=electron-builder npx electron-builder build --mac --x64 \
  --config.mac.notarize=false \
  --config.mac.hardenedRuntime=true \
  --config.mac.gatekeeperAssess=false \
  --config.afterSign="${AFTERSCRIPT_PATH}" \
  --config.artifactName='${productName}-${version}-x64.${ext}'

# Find the .app file
APP_PATH=$(find "${RELEASE_DIR}/mac" -name "*.app" | head -n 1)
if [ -z "$APP_PATH" ]; then
  echo -e "${RED}Error: Cannot find .app file in ${RELEASE_DIR}/mac${NC}"
  exit 1
fi

echo -e "${GREEN}Found app: ${APP_PATH}${NC}"

# Verify code signature
echo -e "${GREEN}Verifying code signature...${NC}"
codesign -vvv --deep --strict "${APP_PATH}"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Code signature verification passed.${NC}"
else
  echo -e "${RED}❌ Code signature verification failed.${NC}"
  exit 1
fi

# Find the DMG file
DMG_FILE=$(find "${RELEASE_DIR}" -name "*-x64.dmg" | head -n 1)
if [ -z "$DMG_FILE" ]; then
  # Try to find the DMG without the architecture suffix, which is the default for x64 builds
  DMG_FILE=$(find "${RELEASE_DIR}" -name "*.dmg" -not -name "*-arm64.dmg" | head -n 1)
  if [ -z "$DMG_FILE" ]; then
    echo -e "${RED}Error: Cannot find DMG file for x64 build in ${RELEASE_DIR}${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Found DMG: ${DMG_FILE}${NC}"

# Notarize the DMG
if [ "$SKIP_NOTARIZE" = false ]; then
  echo -e "${GREEN}Submitting app for notarization...${NC}"
  # Create a temporary file for the submission output
  SUBMIT_OUTPUT_FILE=$(mktemp)
  
  # Submit for notarization
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
  SUBMISSION_ID=$(cat "${SUBMIT_OUTPUT_FILE}" | grep -o '"id": *"[^"]*"' | head -n 1 | grep -o '"[^"]*"$' | tr -d '"')
  
  # If we couldn't extract the ID, but we can see the status is Accepted, try to extract directly from status
  if [ -z "$SUBMISSION_ID" ] && grep -q '"status": *"Accepted"' "${SUBMIT_OUTPUT_FILE}"; then
    # Try different extraction method
    SUBMISSION_ID=$(cat "${SUBMIT_OUTPUT_FILE}" | grep -o '"id": *"[^"]*"' | head -n 1 | cut -d'"' -f4)
    # If still empty but status is Accepted, hardcode the status
    if [ -z "$SUBMISSION_ID" ]; then
      echo -e "${YELLOW}Warning: Could not extract submission ID from output, but status is Accepted${NC}"
      SUBMISSION_ID=$(cat "${SUBMIT_OUTPUT_FILE}" | tr -d '\n\r' | sed -E 's/.*"id":"([^"]*)".*/\1/')
      NOTARIZATION_STATUS="Accepted"
    fi
  fi
  
  if [ -n "$SUBMISSION_ID" ]; then
    echo -e "${GREEN}Successfully got submission ID: ${SUBMISSION_ID}${NC}"
    
    # Fetch detailed notarization log
    echo -e "${GREEN}Fetching detailed notarization log...${NC}"
    mkdir -p logs
    LOG_FILENAME="logs/notarization-x86-${SUBMISSION_ID}-$(date +%Y%m%d-%H%M%S).log"
    
    xcrun notarytool log "${SUBMISSION_ID}" \
      --apple-id "${APPLE_ID}" \
      --password "${APPLE_PASSWORD}" \
      --team-id "${APPLE_TEAM_ID}" \
      "${LOG_FILENAME}"
    
    echo -e "${GREEN}======================== NOTARIZATION LOG ========================${NC}"
    cat "${LOG_FILENAME}"
    echo -e "${GREEN}==============================================================${NC}"
    
    # Check notarization status
    if [ -z "$NOTARIZATION_STATUS" ]; then
      NOTARIZATION_STATUS=$(xcrun notarytool info "${SUBMISSION_ID}" \
        --apple-id "${APPLE_ID}" \
        --password "${APPLE_PASSWORD}" \
        --team-id "${APPLE_TEAM_ID}" \
        --output-format json | grep -o '"status": "[^"]*"' | cut -d'"' -f4)
    fi
    
    if [ "$NOTARIZATION_STATUS" = "Accepted" ]; then
      echo -e "${GREEN}Notarization successful! Stapling ticket to application...${NC}"
      xcrun stapler staple "${DMG_FILE}"
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Stapling completed successfully.${NC}"
        
        # Successfully notarized, update DMG_FILE to be the stapled one
        STAPLED_DMG_FILE="${DMG_FILE}"
      else
        echo -e "${RED}❌ Stapling failed.${NC}"
      fi
    else
      echo -e "${RED}Notarization failed with status: ${NOTARIZATION_STATUS}${NC}"
      SKIP_PUBLISH=true
    fi
  else
    echo -e "${RED}Failed to get submission ID. Notarization failed.${NC}"
    echo -e "${RED}Check the submission output above for more details.${NC}"
    SKIP_PUBLISH=true
  fi
  
  # Clean up temporary file
  rm -f "${SUBMIT_OUTPUT_FILE}"
  
  echo -e "${GREEN}Notarization process complete.${NC}"
else
  echo -e "${YELLOW}Skipping notarization step...${NC}"
fi

# Publish to S3
if [ "$SKIP_PUBLISH" = false ]; then
  echo -e "${GREEN}Publishing to S3...${NC}"
  
  # Get the file name from the path and standardize it (replace spaces with hyphens)
  FILE_NAME=$(basename "$DMG_FILE")
  STANDARD_NAME=$(echo "$FILE_NAME" | sed 's/ /-/g')
  
  # Set S3 destination paths
  S3_VERSIONED_PATH="releases/macos/${VERSION}/${STANDARD_NAME}"
  S3_LATEST_PATH="releases/macos/latest/${STANDARD_NAME}"
  
  echo -e "${GREEN}Uploading to S3 bucket: ${S3_BUCKET}${NC}"
  echo -e "${GREEN}File: ${DMG_FILE}${NC}"
  echo -e "${GREEN}Size: $(du -h "$DMG_FILE" | cut -f1)${NC}"
  
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
else
  echo -e "${YELLOW}Skipping publish step...${NC}"
fi

echo -e "${GREEN}=== Process Complete ===${NC}"
echo -e "${GREEN}App: ${APP_PATH}${NC}"
echo -e "${GREEN}DMG: ${DMG_FILE}${NC}"

if [ "$SKIP_NOTARIZE" = false ]; then
  if [ -n "$SUBMISSION_ID" ] && [ "$NOTARIZATION_STATUS" = "Accepted" ]; then
    echo -e "${GREEN}Notarization: ✅ Successful${NC}"
  else
    echo -e "${RED}Notarization: ❌ Failed${NC}"
  fi
else
  echo -e "${YELLOW}Notarization: ⏭️ Skipped${NC}"
fi

if [ "$SKIP_PUBLISH" = false ]; then
  echo -e "${GREEN}Publishing: ✅ Successfully published to S3${NC}"
else
  echo -e "${YELLOW}Publishing: ⏭️ Skipped${NC}"
fi 