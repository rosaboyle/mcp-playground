#!/bin/bash
# Script to create a properly signed ZIP file from a built Mac application

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
APP_DIR="release/mac/TRMX Agent.app"
OUTPUT_DIR="release"
ENTITLEMENTS_PATH="build/entitlements.mac.plist"

# Print help message
show_help() {
  echo "Usage: $0 [options]"
  echo ""
  echo "This script creates a signed ZIP file from a built Mac application"
  echo ""
  echo "Options:"
  echo "  -h, --help            Show this help message"
  echo "  -a, --app PATH        Path to the .app bundle (default: release/mac/TRMX Agent.app)"
  echo "  -o, --output DIR      Output directory (default: release)"
  echo "  -e, --entitlements FILE Path to entitlements file (default: build/entitlements.mac.plist)"
  echo ""
}

# Parse arguments
while (( "$#" )); do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -a|--app)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        APP_DIR="$2"
        shift 2
      else
        echo "Error: Argument for $1 is missing" >&2
        show_help
        exit 1
      fi
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
    -e|--entitlements)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        ENTITLEMENTS_PATH="$2"
        shift 2
      else
        echo "Error: Argument for $1 is missing" >&2
        show_help
        exit 1
      fi
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
echo -e "${GREEN}= macOS App Signing and ZIP Creation Process =${NC}"
echo -e "${GREEN}==============================================${NC}"

# Check if app exists
if [ ! -d "$APP_DIR" ]; then
  echo -e "${RED}Error: App bundle not found at '$APP_DIR'${NC}"
  exit 1
fi

# Check if entitlements file exists
if [ ! -f "$ENTITLEMENTS_PATH" ]; then
  echo -e "${RED}Error: Entitlements file not found at '$ENTITLEMENTS_PATH'${NC}"
  exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Get the app name without the .app extension
APP_NAME=$(basename "$APP_DIR" .app)
echo -e "${BLUE}App name: ${APP_NAME}${NC}"

# Get version from Info.plist
APP_VERSION=$(defaults read "$APP_DIR/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "unknown")
echo -e "${BLUE}App version: ${APP_VERSION}${NC}"

# ZIP filename
ZIP_FILENAME="${APP_NAME}-${APP_VERSION}-$(uname -m)-mac.zip"
ZIP_PATH="${OUTPUT_DIR}/${ZIP_FILENAME}"
echo -e "${BLUE}ZIP output: ${ZIP_PATH}${NC}"

# Find available signing identities
echo -e "${GREEN}Available signing identities:${NC}"
security find-identity -v -p codesigning | grep "Developer ID Application"

# Get the first valid Developer ID Application identity
DEVELOPER_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -n 1 | sed -n 's/.*"\(Developer ID Application: .*\)"/\1/p')

if [ -z "$DEVELOPER_IDENTITY" ]; then
  echo -e "${RED}Error: No valid Developer ID Application identity found.${NC}"
  echo -e "${YELLOW}Please ensure you have a valid Developer ID certificate installed.${NC}"
  exit 1
fi

echo -e "${GREEN}Using signing identity: ${DEVELOPER_IDENTITY}${NC}"

# Fix Squirrel.framework signing issues
echo -e "${GREEN}Fixing Squirrel.framework signing issues...${NC}"
SHIPIT_PATH="${APP_DIR}/Contents/Frameworks/Squirrel.framework/Versions/A/Resources/ShipIt"

if [ -f "$SHIPIT_PATH" ]; then
  echo -e "${GREEN}Found ShipIt binary at: ${SHIPIT_PATH}${NC}"
  
  echo -e "${GREEN}Removing any existing signatures...${NC}"
  codesign --remove-signature "$SHIPIT_PATH" || true
  
  echo -e "${GREEN}Signing ShipIt binary with hardened runtime and entitlements...${NC}"
  codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS_PATH" --sign "$DEVELOPER_IDENTITY" "$SHIPIT_PATH"
  
  # Verify the signature
  echo -e "${GREEN}Verifying ShipIt signature...${NC}"
  codesign --verify --verbose "$SHIPIT_PATH"
else
  echo -e "${YELLOW}ShipIt binary not found. Skipping specific signing.${NC}"
fi

# Sign the app bundle
echo -e "${GREEN}Signing the app bundle...${NC}"
codesign --force --options runtime --deep --timestamp --entitlements "$ENTITLEMENTS_PATH" --sign "$DEVELOPER_IDENTITY" "$APP_DIR"

# Verify the app signature
echo -e "${GREEN}Verifying app signature...${NC}"
codesign --verify --verbose=4 "$APP_DIR"

# Create ZIP file
echo -e "${GREEN}Creating ZIP file...${NC}"
APP_PARENT_DIR=$(dirname "$APP_DIR")
APP_NAME_ONLY=$(basename "$APP_DIR")

# Change to the app's parent directory and create the ZIP from there
pushd "$APP_PARENT_DIR" > /dev/null
zip -r --symlinks "${ZIP_PATH}" "$APP_NAME_ONLY"
popd > /dev/null

echo -e "${GREEN}ZIP file created: ${ZIP_PATH}${NC}"

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= Process completed successfully =${NC}"
echo -e "${GREEN}==============================================${NC}"

echo "To submit this ZIP for notarization, use the following command:"
echo -e "${YELLOW}xcrun notarytool submit \"${ZIP_PATH}\" --apple-id \"YOUR_APPLE_ID\" --password \"YOUR_APP_SPECIFIC_PASSWORD\" --team-id \"YOUR_TEAM_ID\" --wait${NC}"
echo ""
echo "Alternatively, you can use our staple-notarized-app.sh script with the --notarize-dmg option:"
echo -e "${YELLOW}./scripts/staple-notarized-app.sh --create-dmg --notarize-dmg \"${ZIP_PATH}\"${NC}" 