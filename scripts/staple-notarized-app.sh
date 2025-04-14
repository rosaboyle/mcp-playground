#!/bin/bash
# macOS Notarization Stapling Script
# This script staples a notarization ticket to an app and optionally creates a DMG

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Help message
show_help() {
  echo "Usage: $0 [options] [path/to/app.zip]"
  echo ""
  echo "This script extracts an app from a notarized ZIP, staples the notarization ticket,"
  echo "and optionally creates a DMG with the stapled app."
  echo ""
  echo "Options:"
  echo "  -h, --help            Show this help message"
  echo "  -d, --create-dmg      Create a DMG file after stapling"
  echo "  -o, --output-dir DIR  Output directory (default: ./stapled)"
  echo "  -n, --notarize-dmg    Notarize the created DMG (requires Apple credentials)"
  echo ""
  echo "Examples:"
  echo "  $0 release/my-app.zip"
  echo "  $0 --create-dmg release/my-app.zip"
  echo "  $0 --output-dir ./dist release/my-app.zip"
  echo "  $0 --create-dmg --notarize-dmg release/my-app.zip"
  echo ""
}

# Parse arguments
CREATE_DMG=false
NOTARIZE_DMG=false
OUTPUT_DIR="./stapled"
ZIP_FILE=""

while (( "$#" )); do
  case "$1" in
    -h|--help)
      show_help
      exit 0
      ;;
    -d|--create-dmg)
      CREATE_DMG=true
      shift
      ;;
    -n|--notarize-dmg)
      NOTARIZE_DMG=true
      CREATE_DMG=true  # Notarization requires DMG creation
      shift
      ;;
    -o|--output-dir)
      if [ -n "$2" ] && [ ${2:0:1} != "-" ]; then
        OUTPUT_DIR="$2"
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
    *) # preserve positional arguments
      ZIP_FILE="$1"
      shift
      ;;
  esac
done

# Check if ZIP file is provided
if [ -z "$ZIP_FILE" ]; then
  echo -e "${RED}Error: No ZIP file provided${NC}"
  show_help
  exit 1
fi

# Check if ZIP file exists
if [ ! -f "$ZIP_FILE" ]; then
  echo -e "${RED}Error: ZIP file '$ZIP_FILE' not found${NC}"
  exit 1
fi

# Check for required credentials if notarizing DMG
if [ "$NOTARIZE_DMG" = true ]; then
  # Load .env file if available
  if [ -f .env ]; then
    echo -e "${GREEN}Loading environment variables from .env file...${NC}"
    export $(grep -v '^#' .env | xargs)
  fi
  
  # Check for required environment variables
  if [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ] || [ -z "$APPLE_TEAM_ID" ]; then
    echo -e "${RED}Missing required environment variables for DMG notarization.${NC}"
    echo -e "${YELLOW}Please set the following environment variables or include them in an .env file:${NC}"
    echo -e "  - APPLE_ID"
    echo -e "  - APPLE_APP_SPECIFIC_PASSWORD"
    echo -e "  - APPLE_TEAM_ID"
    exit 1
  fi
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= macOS Notarization Stapling Process =${NC}"
echo -e "${GREEN}==============================================${NC}"

echo -e "${BLUE}ZIP file: ${ZIP_FILE}${NC}"
echo -e "${BLUE}Output directory: ${OUTPUT_DIR}${NC}"
if [ "$CREATE_DMG" = true ]; then
  echo -e "${BLUE}Will create DMG: Yes${NC}"
  if [ "$NOTARIZE_DMG" = true ]; then
    echo -e "${BLUE}Will notarize DMG: Yes${NC}"
  else
    echo -e "${BLUE}Will notarize DMG: No${NC}"
  fi
else
  echo -e "${BLUE}Will create DMG: No${NC}"
fi

# Extract the ZIP file
echo -e "${GREEN}Extracting ZIP file...${NC}"
TMP_DIR=$(mktemp -d)
unzip -q "$ZIP_FILE" -d "$TMP_DIR"

# Find the app bundle in the extracted directory
APP_PATH=$(find "$TMP_DIR" -name "*.app" -type d | head -n 1)
if [ -z "$APP_PATH" ]; then
  echo -e "${RED}Error: No .app bundle found in the ZIP file${NC}"
  rm -rf "$TMP_DIR"
  exit 1
fi

APP_NAME=$(basename "$APP_PATH")
echo -e "${GREEN}Found app bundle: ${APP_NAME}${NC}"

# Check if the app is already notarized
echo -e "${GREEN}Checking if app is already notarized...${NC}"
xcrun stapler validate "$APP_PATH" 2>/dev/null
if [ $? -eq 0 ]; then
  echo -e "${GREEN}App is already notarized and has a stapled ticket.${NC}"
else
  echo -e "${YELLOW}App doesn't have a stapled ticket. Stapling now...${NC}"
  
  # Staple the ticket to the app
  echo -e "${GREEN}Stapling notarization ticket to app...${NC}"
  xcrun stapler staple "$APP_PATH"
  
  # Verify stapling was successful
  echo -e "${GREEN}Verifying stapling...${NC}"
  xcrun stapler validate "$APP_PATH"
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Stapling successful!${NC}"
  else
    echo -e "${RED}Failed to staple ticket to app.${NC}"
    echo -e "${YELLOW}This might mean the app was never notarized, or Apple's servers are unavailable.${NC}"
    echo -e "${YELLOW}You can try again later or check if the app was properly notarized.${NC}"
    rm -rf "$TMP_DIR"
    exit 1
  fi
fi

# Copy the stapled app to the output directory
echo -e "${GREEN}Copying stapled app to output directory...${NC}"
cp -R "$APP_PATH" "$OUTPUT_DIR/"
FINAL_APP_PATH="$OUTPUT_DIR/$APP_NAME"
echo -e "${GREEN}Stapled app saved to: ${FINAL_APP_PATH}${NC}"

# Create DMG if requested
if [ "$CREATE_DMG" = true ]; then
  # Extract app name and version for DMG filename
  APP_NAME_WITHOUT_EXTENSION=${APP_NAME%.app}
  DMG_NAME="${APP_NAME_WITHOUT_EXTENSION}.dmg"
  DMG_PATH="$OUTPUT_DIR/$DMG_NAME"
  
  echo -e "${GREEN}Creating DMG file...${NC}"
  
  # Check if create-dmg is installed
  if command -v create-dmg &> /dev/null; then
    echo -e "${GREEN}Using create-dmg tool...${NC}"
    create-dmg \
      --volname "$APP_NAME_WITHOUT_EXTENSION" \
      --window-pos 200 120 \
      --window-size 800 400 \
      --icon-size 100 \
      --icon "$FINAL_APP_PATH" 200 190 \
      --hide-extension "$FINAL_APP_PATH" \
      --app-drop-link 600 185 \
      "$DMG_PATH" \
      "$FINAL_APP_PATH" || {
        echo -e "${YELLOW}Failed to create DMG with create-dmg, trying alternative method...${NC}"
        # Alternative DMG creation method
        hdiutil create -volname "$APP_NAME_WITHOUT_EXTENSION" -srcfolder "$FINAL_APP_PATH" -ov -format UDZO "$DMG_PATH"
      }
  else
    echo -e "${YELLOW}create-dmg tool not found, using hdiutil...${NC}"
    # Create DMG using hdiutil
    hdiutil create -volname "$APP_NAME_WITHOUT_EXTENSION" -srcfolder "$FINAL_APP_PATH" -ov -format UDZO "$DMG_PATH" || {
      echo -e "${RED}Failed to create DMG using hdiutil.${NC}"
      echo -e "${YELLOW}This might be due to permission issues. You can try rebooting your Mac.${NC}"
      echo -e "${YELLOW}Alternatively, install create-dmg tool: npm install -g create-dmg${NC}"
    }
  fi
  
  if [ -f "$DMG_PATH" ]; then
    echo -e "${GREEN}Created DMG file: ${DMG_PATH}${NC}"
    
    # Find the proper developer identity
    DEVELOPER_IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -n 1 | awk -F '"' '{print $2}')
    
    # Sign the DMG
    if [ -n "$DEVELOPER_IDENTITY" ]; then
      echo -e "${GREEN}Signing DMG file...${NC}"
      codesign --force --sign "$DEVELOPER_IDENTITY" --timestamp "$DMG_PATH"
      echo -e "${GREEN}DMG signing completed.${NC}"
    else
      echo -e "${YELLOW}No Developer ID Application identity found. DMG will not be signed.${NC}"
    fi
    
    # Notarize the DMG if requested
    if [ "$NOTARIZE_DMG" = true ]; then
      echo -e "${GREEN}Notarizing DMG file...${NC}"
      
      # Generate a timestamp for log file
      TIMESTAMP=$(date +%Y%m%d-%H%M%S)
      LOGS_DIR="./logs"
      mkdir -p "$LOGS_DIR"
      LOG_FILE="${LOGS_DIR}/dmg-notarization-${TIMESTAMP}.log"
      
      # Submit for notarization
      echo -e "${YELLOW}This may take several minutes...${NC}"
      xcrun notarytool submit "$DMG_PATH" \
        --apple-id "${APPLE_ID}" \
        --password "${APPLE_APP_SPECIFIC_PASSWORD}" \
        --team-id "${APPLE_TEAM_ID}" \
        --wait | tee "${LOG_FILE}"
      
      # Extract submission ID from log
      SUBMISSION_ID=$(cat "${LOG_FILE}" | grep -o '"id": *"[^"]*"' | head -n 1 | grep -o '"[^"]*"$' | tr -d '"')
      
      if [ -n "$SUBMISSION_ID" ]; then
        echo -e "${GREEN}Fetching detailed notarization log...${NC}"
        NOTARIZATION_LOG="${LOGS_DIR}/dmg-notarization-details-${SUBMISSION_ID}-${TIMESTAMP}.log"
        
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
          echo -e "${GREEN}DMG notarization successful! Stapling ticket to DMG...${NC}"
          xcrun stapler staple "$DMG_PATH"
          
          # Verify stapling was successful
          echo -e "${GREEN}Verifying DMG stapling...${NC}"
          xcrun stapler validate "$DMG_PATH"
          if [ $? -eq 0 ]; then
            echo -e "${GREEN}DMG stapling successful!${NC}"
          else
            echo -e "${YELLOW}DMG stapling verification failed. This might be a temporary issue.${NC}"
            echo -e "${YELLOW}The DMG is still notarized and should work, but you may want to try stapling again later.${NC}"
          fi
        else
          echo -e "${RED}DMG notarization failed with status: ${NOTARIZATION_STATUS}${NC}"
          echo -e "${RED}Check the log for details: ${NOTARIZATION_LOG}${NC}"
        fi
      else
        echo -e "${RED}Failed to get submission ID. DMG notarization may have failed.${NC}"
      fi
    else
      echo -e "${YELLOW}DMG notarization not requested. Note that a DMG without notarization may trigger security warnings.${NC}"
      echo -e "${YELLOW}To notarize the DMG, use the --notarize-dmg option.${NC}"
    fi
  fi
fi

# Clean up temporary directory
rm -rf "$TMP_DIR"

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}= Process completed successfully =${NC}"
echo -e "${GREEN}==============================================${NC}"

echo -e "${GREEN}Stapled app is available at: ${FINAL_APP_PATH}${NC}"
if [ "$CREATE_DMG" = true ] && [ -f "$DMG_PATH" ]; then
  echo -e "${GREEN}DMG file is available at: ${DMG_PATH}${NC}"
  if [ "$NOTARIZE_DMG" = false ]; then
    echo -e "${YELLOW}Note: The DMG has not been notarized. To notarize it, use the --notarize-dmg option.${NC}"
  fi
fi 