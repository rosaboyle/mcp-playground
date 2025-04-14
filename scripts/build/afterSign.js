// This is a placeholder for the afterSign hook
// The real notarization happens after the build using xcrun notarytool
exports.default = async function() {
  console.log('Skipping automatic notarization in afterSign hook');
  return;
};
