#!/bin/bash
# Script to build, sign, and package an Electron application

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
OUTPUT_DIR="release"
NOTARIZE=false

# Print help message
show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "This script builds, signs, and packages an Electron application"
  echo ""
  echo "Options:"
  echo "  -h, --help            Show this help message"
  echo "  -o, --output DIR      Output directory (default: release)"
  echo "  -n, --notarize        Submit the ZIP for notarization (requires .env file with Apple credentials)"
  echo ""
  echo "Example:"
  echo "  $0 --output ./dist --notarize"
  echo ""
}

# Parse arguments
while (( "$#" )); do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -o|--output)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        OUTPUT_DIR="$2"
        shift 2
      else
        echo "Error: Argument for $1 is missing" >&2
        show_help
        exit 1
      fi
      ;;
    -n|--notarize)
      NOTARIZE=true
      shift
      ;;
    -*|--*=) # unsupported flags
      echo "Error: Unsupported flag $1" >&2
      show_help
      exit 1
      ;;
    *) # unsupported positional arguments
      echo "Error: Unsupported argument $1" >&2
      show_help
      exit 1
      ;;
  esac
done

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= Electron App Build and Packaging Process =${NC}"
echo -e "${GREEN}==============================================${NC}"

# Check if package.json exists to confirm we're in an electron project
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: package.json not found. Are you in the correct directory?${NC}"
  exit 1
fi

# Check for required tools
echo -e "${GREEN}Checking for required tools...${NC}"
for cmd in node npm zip codesign; do
  if ! command -v $cmd &> /dev/null; then
    echo -e "${RED}Error: $cmd is not installed or not in PATH${NC}"
    exit 1
  fi
done

echo -e "${GREEN}All required tools are installed.${NC}"

# Load environment variables if .env file exists
if [ -f .env ]; then
  echo -e "${GREEN}Loading environment variables from .env file...${NC}"
  export $(grep -v '^#' .env | xargs)
fi

# Check for required environment variables if notarizing
if [ "$NOTARIZE" = true ]; then
  if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}Missing required environment variables for notarization.${NC}"
    echo -e "${YELLOW}Please set the following environment variables or include them in an .env file:${NC}"
    echo -e "  - APPLE_ID"
    echo -e "  - APPLE_APP_SPECIFIC_PASSWORD"
    echo -e "  - APPLE_TEAM_ID"
    exit 1
  fi
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Get app information from package.json
APP_NAME=$(node -e "console.log(require('./package.json').productName || require('./package.json').name)")
APP_VERSION=$(node -e "console.log(require('./package.json').version)")

echo -e "${BLUE}Building app: ${APP_NAME} v${APP_VERSION}${NC}"

# Set environment variable for notarization if requested
if [ "$NOTARIZE" = true ]; then
  echo -e "${GREEN}Setting up notarization...${NC}"
  export ELECTRON_NOTARIZE=true
else
  export ELECTRON_NOTARIZE=false
fi

# Clean build directory
echo -e "${GREEN}Cleaning build directory...${NC}"
npm run clean

# Find developer identity and extract just the ID (without the "Developer ID Application:" prefix)
echo -e "${GREEN}Finding signing identity...${NC}"
security find-identity -v -p codesigning | grep "Developer ID Application"

# Get just the certificate ID without the "Developer ID Application:" prefix
FULL_DEVELOPER_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -n 1 | sed -n 's/.*"\(Developer ID Application: .*\)"/\1/p')
# Extract just the ID part after the colon and space
DEVELOPER_ID=$(echo "$FULL_DEVELOPER_IDENTITY" | sed 's/Developer ID Application: \(.*\)/\1/')

if [ -z "$DEVELOPER_ID" ]; then
  echo -e "${RED}Error: No valid Developer ID Application identity found.${NC}"
  echo -e "${YELLOW}Please ensure you have a valid Developer ID certificate installed.${NC}"
  exit 1
fi

echo -e "${GREEN}Found full identity: ${FULL_DEVELOPER_IDENTITY}${NC}"
echo -e "${GREEN}Using certificate ID: ${DEVELOPER_ID}${NC}"

# Set environment variables for electron-builder
export CSC_IDENTITY_AUTO_DISCOVERY=false
export CSC_NAME="$DEVELOPER_ID"
export ELECTRON_TEAM_ID="$APPLE_TEAM_ID"
export ELECTRON_NOTARIZE="$NOTARIZE"

# Run build
echo -e "${GREEN}Building application...${NC}"
npm run build

# Run electron-builder
echo -e "${GREEN}Packaging application with electron-builder...${NC}"
NOTARIZE_OPT=""
if [ "$NOTARIZE" = true ]; then
  NOTARIZE_OPT="--config.mac.notarize=true"
fi

npx electron-builder build --mac dir $NOTARIZE_OPT

# Find the app bundle - first check for arm64 path
APP_PATH=""
MAC_DIRS=("release/mac-arm64" "release/mac" "release/mac-x64")

for dir in "${MAC_DIRS[@]}"; do
  if [ -d "$dir/$APP_NAME.app" ]; then
    APP_PATH="$dir/$APP_NAME.app"
    echo -e "${GREEN}Found app at: ${APP_PATH}${NC}"
    break
  fi
done

# If still not found, do a wider search
if [ -z "$APP_PATH" ]; then
  echo -e "${YELLOW}Could not find built app at expected paths. Searching for it...${NC}"
  APP_PATH=$(find . -name "*.app" -type d | grep -v "node_modules" | head -n 1)
  
  if [ -z "$APP_PATH" ]; then
    echo -e "${RED}Error: Could not find built .app bundle.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}App built successfully: ${APP_PATH}${NC}"

# Create entitlements file if it doesn't exist
if [ ! -f "build/entitlements.mac.plist" ]; then
  echo -e "${YELLOW}Entitlements file not found. Creating it...${NC}"
  mkdir -p build
  cat > build/entitlements.mac.plist << EOL
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
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
  </dict>
</plist>
EOL
fi

# Sign ShipIt binary separately
echo -e "${GREEN}Fixing Squirrel.framework signing issues...${NC}"
SHIPIT_PATH="${APP_PATH}/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"

if [ -f "$SHIPIT_PATH" ]; then
  echo -e "${GREEN}Found ShipIt binary at: ${SHIPIT_PATH}${NC}"
  
  echo -e "${GREEN}Removing any existing signatures...${NC}"
  codesign --remove-signature "$SHIPIT_PATH" || true
  
  echo -e "${GREEN}Signing ShipIt binary with hardened runtime and entitlements...${NC}"
  codesign --force --options runtime --timestamp --entitlements "build/entitlements.mac.plist" --sign "$FULL_DEVELOPER_IDENTITY" "$SHIPIT_PATH"
  
  # Verify the signature
  echo -e "${GREEN}Verifying ShipIt signature...${NC}"
  codesign --verify --verbose "$SHIPIT_PATH"
else
  echo -e "${YELLOW}ShipIt binary not found. Skipping specific signing.${NC}"
fi

# Sign the app bundle
echo -e "${GREEN}Signing the app bundle...${NC}"
codesign --force --options runtime --deep --timestamp --entitlements "build/entitlements.mac.plist" --sign "$FULL_DEVELOPER_IDENTITY" "$APP_PATH"

# Verify the app signature
echo -e "${GREEN}Verifying app signature...${NC}"
codesign --verify --verbose=4 "$APP_PATH"

# Create ZIP file
echo -e "${GREEN}Creating ZIP file...${NC}"
APP_PARENT_DIR=$(dirname "$APP_PATH")
APP_NAME_ONLY=$(basename "$APP_PATH")
ARCH=$(uname -m)
ZIP_FILENAME="${APP_NAME}-${APP_VERSION}-${ARCH}-mac.zip"
ZIP_PATH="${OUTPUT_DIR}/${ZIP_FILENAME}"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Change to the app's parent directory and create the ZIP from there
echo -e "${GREEN}Creating ZIP from directory: ${APP_PARENT_DIR}${NC}"
echo -e "${GREEN}Output ZIP will be: ${ZIP_PATH}${NC}"

pushd "$APP_PARENT_DIR" > /dev/null
zip -r --symlinks "../../${ZIP_PATH}" "$APP_NAME_ONLY"
popd > /dev/null

# Verify the ZIP file was created
if [ ! -f "$ZIP_PATH" ]; then
  echo -e "${RED}Error: Failed to create ZIP file at '${ZIP_PATH}'${NC}"
  echo -e "${YELLOW}Trying alternative ZIP creation method...${NC}"
  
  # Try an alternative method for creating the ZIP
  APP_FULL_PATH=$(cd "$(dirname "$APP_PATH")" && pwd)/$(basename "$APP_PATH")
  ZIP_FULL_PATH=$(cd "$(dirname "$ZIP_PATH")" && pwd)/$(basename "$ZIP_PATH")
  
  echo -e "${GREEN}Creating ZIP using absolute paths:${NC}"
  echo -e "${GREEN}App: ${APP_FULL_PATH}${NC}"
  echo -e "${GREEN}ZIP: ${ZIP_FULL_PATH}${NC}"
  
  cd "$(dirname "$APP_FULL_PATH")"
  zip -r --symlinks "$ZIP_FULL_PATH" "$(basename "$APP_FULL_PATH")"
  
  if [ ! -f "$ZIP_PATH" ]; then
    echo -e "${RED}Error: Both ZIP creation methods failed. Please check paths and permissions.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}ZIP file created: ${ZIP_PATH}${NC}"

# Notarize if requested
if [ "$NOTARIZE" = true ]; then
  echo -e "${GREEN}Notarizing application...${NC}"
  
  # Generate a timestamp for log file
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  LOGS_DIR="./logs"
  mkdir -p "$LOGS_DIR"
  LOG_FILE="${LOGS_DIR}/notarization-${TIMESTAMP}.log"
  
  # Submit for notarization
  echo -e "${YELLOW}Submitting app for notarization. This may take several minutes...${NC}"
  xcrun notarytool submit "$ZIP_PATH" \
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
      echo -e "${GREEN}Notarization successful! Creating stapled app...${NC}"
      
      # Extract the ZIP file
      TMP_DIR=$(mktemp -d)
      unzip -q "$ZIP_PATH" -d "$TMP_DIR"
      
      # Find the app bundle in the extracted directory
      EXTRACTED_APP=$(find "$TMP_DIR" -name "*.app" -type d | head -n 1)
      
      # Staple the ticket to the app
      echo -e "${GREEN}Stapling notarization ticket to app...${NC}"
      xcrun stapler staple "$EXTRACTED_APP"
      
      # Verify stapling was successful
      echo -e "${GREEN}Verifying stapling...${NC}"
      xcrun stapler validate "$EXTRACTED_APP"
      
      # Create DMG file
      DMG_PATH="${OUTPUT_DIR}/${APP_NAME}-${APP_VERSION}-$(uname -m)-mac.dmg"
      echo -e "${GREEN}Creating notarized DMG file...${NC}"
      
      # Check if create-dmg is installed
      if command -v create-dmg &> /dev/null; then
        echo -e "${GREEN}Using create-dmg tool...${NC}"
        create-dmg \
          --volname "$APP_NAME" \
          --window-pos 200 120 \
          --window-size 800 400 \
          --icon-size 100 \
          --icon "$EXTRACTED_APP" 200 190 \
          --hide-extension "$EXTRACTED_APP" \
          --app-drop-link 600 185 \
          "$DMG_PATH" \
          "$EXTRACTED_APP" || {
            echo -e "${YELLOW}Failed to create DMG with create-dmg, trying alternative method...${NC}"
            # Alternative DMG creation method
            hdiutil create -volname "$APP_NAME" -srcfolder "$EXTRACTED_APP" -ov -format UDZO "$DMG_PATH"
          }
      else
        echo -e "${YELLOW}create-dmg tool not found, using hdiutil...${NC}"
        # Create DMG using hdiutil
        hdiutil create -volname "$APP_NAME" -srcfolder "$EXTRACTED_APP" -ov -format UDZO "$DMG_PATH"
      fi
      
      # Sign the DMG
      echo -e "${GREEN}Signing DMG file...${NC}"
      codesign --force --sign "$FULL_DEVELOPER_IDENTITY" --timestamp "$DMG_PATH"
      
      # Staple the DMG
      echo -e "${GREEN}Stapling notarization ticket to DMG...${NC}"
      xcrun stapler staple "$DMG_PATH"
      
      # Verify DMG stapling
      echo -e "${GREEN}Verifying DMG stapling...${NC}"
      xcrun stapler validate "$DMG_PATH"
      
      # Clean up temp directory
      rm -rf "$TMP_DIR"
      
      echo -e "${GREEN}Notarized DMG created: ${DMG_PATH}${NC}"
    else
      echo -e "${RED}Notarization failed with status: ${NOTARIZATION_STATUS}${NC}"
      echo -e "${RED}Check the log for details: ${NOTARIZATION_LOG}${NC}"
    fi
  else
    echo -e "${RED}Failed to get submission ID. Notarization may have failed.${NC}"
  fi
fi

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= Process completed successfully =${NC}"
echo -e "${GREEN}==============================================${NC}"

echo -e "${GREEN}App bundle: ${APP_PATH}${NC}"
echo -e "${GREEN}ZIP file: ${ZIP_PATH}${NC}"

if [ "$NOTARIZE" = true ] && [ -f "$DMG_PATH" ]; then
  echo -e "${GREEN}Notarized DMG: ${DMG_PATH}${NC}"
elif [ "$NOTARIZE" = true ]; then
  echo -e "${YELLOW}No notarized DMG was created.${NC}"
fi

echo ""
echo "To create a DMG from your app, run:"
echo -e "${YELLOW}./scripts/staple-notarized-app.sh --create-dmg \"${ZIP_PATH}\"${NC}"
echo ""
echo "To notarize this build, run:"
echo -e "${YELLOW}./scripts/staple-notarized-app.sh --create-dmg --notarize-dmg \"${ZIP_PATH}\"${NC}" 