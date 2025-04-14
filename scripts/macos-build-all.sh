#!/bin/bash
# macOS Build Script for all architectures
# This script runs both arm64 and x86_64 builds

set -e # Exit on error

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default settings
SKIP_NOTARIZE=false
SKIP_PUBLISH=false
BUILD_ARM64=true
BUILD_X86=true

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
    --arm64-only)
      BUILD_X86=false
      shift
      ;;
    --x86-only)
      BUILD_ARM64=false
      shift
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --skip-notarize    Skip notarization step"
      echo "  --skip-publish     Skip S3 publishing step"
      echo "  --arm64-only       Build only for Apple Silicon (arm64)"
      echo "  --x86-only         Build only for Intel (x86_64)"
      echo "  --help             Show this help"
      exit 0
      ;;
  esac
done

# Build flags
BUILD_FLAGS=""
if [ "$SKIP_NOTARIZE" = true ]; then
  BUILD_FLAGS="$BUILD_FLAGS --skip-notarize"
fi
if [ "$SKIP_PUBLISH" = true ]; then
  BUILD_FLAGS="$BUILD_FLAGS --skip-publish"
fi

echo -e "${BLUE}=== macOS Build All Script ===${NC}"
echo -e "${BLUE}Build arm64: ${BUILD_ARM64}${NC}"
echo -e "${BLUE}Build x86_64: ${BUILD_X86}${NC}"
echo -e "${BLUE}Skip notarize: ${SKIP_NOTARIZE}${NC}"
echo -e "${BLUE}Skip publish: ${SKIP_PUBLISH}${NC}"
echo -e "${BLUE}==========================${NC}"

# Ensure scripts are executable
chmod +x scripts/macos-arm64-build.sh
chmod +x scripts/macos-x86-build.sh

# Run arm64 build if enabled
if [ "$BUILD_ARM64" = true ]; then
  echo -e "${GREEN}=========================================${NC}"
  echo -e "${GREEN}=== Starting macOS ARM64 Build Process ===${NC}"
  echo -e "${GREEN}=========================================${NC}"
  
  if ./scripts/macos-arm64-build.sh $BUILD_FLAGS; then
    echo -e "${GREEN}=======================================${NC}"
    echo -e "${GREEN}=== macOS ARM64 Build Process Done ===${NC}"
    echo -e "${GREEN}=======================================${NC}"
  else
    ARM64_FAILED=true
    echo -e "${RED}=======================================${NC}"
    echo -e "${RED}=== macOS ARM64 Build Process FAILED ===${NC}"
    echo -e "${RED}=======================================${NC}"
  fi
fi

# Run x86_64 build if enabled
if [ "$BUILD_X86" = true ]; then
  echo -e "${YELLOW}==========================================${NC}"
  echo -e "${YELLOW}=== Starting macOS x86_64 Build Process ===${NC}"
  echo -e "${YELLOW}==========================================${NC}"
  
  if ./scripts/macos-x86-build.sh $BUILD_FLAGS; then
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}=== macOS x86_64 Build Process Done ===${NC}"
    echo -e "${YELLOW}========================================${NC}"
  else
    X86_FAILED=true
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}=== macOS x86_64 Build Process FAILED ===${NC}"
    echo -e "${RED}========================================${NC}"
  fi
fi

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}=== All macOS Build Processes Completed ===${NC}"
echo -e "${BLUE}=============================================${NC}"

# Report overall status
if [ "$BUILD_ARM64" = true ] && [ "${ARM64_FAILED:-false}" = true ]; then
  echo -e "${RED}ARM64 build failed${NC}"
  OVERALL_STATUS=1
fi

if [ "$BUILD_X86" = true ] && [ "${X86_FAILED:-false}" = true ]; then
  echo -e "${RED}x86_64 build failed${NC}"
  OVERALL_STATUS=1
fi

if [ "${OVERALL_STATUS:-0}" = 1 ]; then
  echo -e "${RED}One or more builds failed${NC}"
  exit 1
else
  echo -e "${GREEN}All builds completed successfully${NC}"
fi 