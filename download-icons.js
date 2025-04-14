const https = require('https');
const fs = require('fs');
const path = require('path');

// Function to download a file from a URL
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);

        console.log(`Downloading ${url} to ${destination}...`);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${url} to ${destination}`);
                resolve();
            });
        }).on('error', (error) => {
            fs.unlink(destination, () => { });
            reject(error);
        });

        file.on('error', (error) => {
            fs.unlink(destination, () => { });
            reject(error);
        });
    });
}

// Ensure assets/icons directory exists
const iconsDir = path.join(__dirname, 'assets', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// URLs for placeholder icons
const icons = [
    {
        url: 'https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/templates/icons/icon.ico',
        destination: path.join(iconsDir, 'icon.ico')
    },
    {
        url: 'https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/templates/icons/256x256.png',
        destination: path.join(iconsDir, 'icon.png')
    },
    {
        url: 'https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/templates/icons/icon.icns',
        destination: path.join(iconsDir, 'icon.icns')
    }
];

// Download all icons
Promise.all(icons.map(icon => downloadFile(icon.url, icon.destination)))
    .then(() => {
        console.log('All icons downloaded successfully');
    })
    .catch((error) => {
        console.error('Error downloading icons:', error);
    }); 