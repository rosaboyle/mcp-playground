#!/bin/bash
# macOS Code Signing and Notarization Script
# Usage: ./macos-sign-notarize.sh [--skip-build] [--skip-notarize]

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Default settings
SKIP_BUILD=false
SKIP_NOTARIZE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-notarize)
      SKIP_NOTARIZE=true
      shift
      ;;
  esac
done

# Configuration (edit these variables)
APP_NAME="Trmx Agent"
APPLE_ID="${APPLE_ID:-}"  # Use environment variable or empty
APPLE_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD:-}" # Use environment variable or empty
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}" # Use environment variable or empty

# Project paths
PROJECT_DIR=$(pwd)
BUILD_DIR="${PROJECT_DIR}/build"
RELEASE_DIR="${PROJECT_DIR}/release"
ENTITLEMENTS_PATH="${BUILD_DIR}/entitlements.mac.plist"
AFTERSCRIPT_PATH="${BUILD_DIR}/afterSign.js"

# Create necessary directories
mkdir -p "${BUILD_DIR}"

echo -e "${GREEN}=== macOS Code Signing and Notarization ===${NC}"

# Ensure we have the necessary credentials
if [ -z "$APPLE_ID" ] || [ -z "$APPLE_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
  echo -e "${YELLOW}Warning: Missing Apple credentials. Please set the following environment variables:${NC}"
  [ -z "$APPLE_ID" ] && echo "  - APPLE_ID"
  [ -z "$APPLE_PASSWORD" ] && echo "  - APPLE_APP_SPECIFIC_PASSWORD"
  [ -z "$APPLE_TEAM_ID" ] && echo "  - APPLE_TEAM_ID"
  
  echo -e "\n${YELLOW}You can set them temporarily with:${NC}"
  echo "export APPLE_ID=your.email@example.com"
  echo "export APPLE_APP_SPECIFIC_PASSWORD=your-app-specific-password"
  echo "export APPLE_TEAM_ID=your-team-id"
  
  if [ "$SKIP_NOTARIZE" = false ]; then
    echo -e "\n${YELLOW}Proceeding without notarization. Use --skip-notarize to suppress this warning.${NC}"
    SKIP_NOTARIZE=true
  fi
fi

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

# Get application version
APP_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Building version: ${APP_VERSION}${NC}"

# Build the application
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${GREEN}Running webpack build...${NC}"
  npm run build
  
  echo -e "${GREEN}Building macOS app with electron-builder...${NC}"
  # Set environment variables for code signing
  export CSC_FOR_PULL_REQUEST=true
  
  # Run electron-builder
  DEBUG=electron-builder npx electron-builder build --mac \
    --config.mac.notarize=false \
    --config.mac.hardenedRuntime=true \
    --config.mac.gatekeeperAssess=false \
    --config.afterSign="${AFTERSCRIPT_PATH}"
else
  echo -e "${YELLOW}Skipping build step...${NC}"
fi

# Find the .app file
APP_PATH=$(find "${RELEASE_DIR}" -name "*.app" | head -n 1)
if [ -z "$APP_PATH" ]; then
  echo -e "${RED}Error: Cannot find .app file in ${RELEASE_DIR}${NC}"
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
DMG_FILE=$(find "${RELEASE_DIR}" -name "*.dmg" | head -n 1)
if [ -z "$DMG_FILE" ]; then
  echo -e "${RED}Error: Cannot find .dmg file in ${RELEASE_DIR}${NC}"
  exit 1
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
  SUBMISSION_ID=$(cat "${SUBMIT_OUTPUT_FILE}" | grep -o '"id": "[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$SUBMISSION_ID" ]; then
    echo -e "${GREEN}Successfully got submission ID: ${SUBMISSION_ID}${NC}"
    
    # Fetch detailed notarization log
    echo -e "${GREEN}Fetching detailed notarization log...${NC}"
    xcrun notarytool log "${SUBMISSION_ID}" \
      --apple-id "${APPLE_ID}" \
      --password "${APPLE_PASSWORD}" \
      --team-id "${APPLE_TEAM_ID}" notarization.log
    
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
  
  echo -e "${GREEN}Notarization process complete.${NC}"
else
  echo -e "${YELLOW}Skipping notarization step...${NC}"
fi

echo -e "${GREEN}=== Process Complete ===${NC}"
echo -e "${GREEN}App: ${APP_PATH}${NC}"
echo -e "${GREEN}DMG: ${DMG_FILE}${NC}"
if [ "$SKIP_NOTARIZE" = false ] && [ -n "$SUBMISSION_ID" ] && [ "$NOTARIZATION_STATUS" = "Accepted" ]; then
  echo -e "${GREEN}Notarization: ✅ Successful${NC}"
elif [ "$SKIP_NOTARIZE" = true ]; then
  echo -e "${YELLOW}Notarization: ⏭️ Skipped${NC}"
else
  echo -e "${RED}Notarization: ❌ Failed${NC}"
fi 