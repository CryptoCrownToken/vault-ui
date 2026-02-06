const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'public', 'vault-logo.svg');
const pngPath = path.join(__dirname, '..', 'public', 'vault-logo.png');

const svgContent = fs.readFileSync(svgPath, 'utf-8');

// Convert to PNG at 512x512 for good quality
sharp(Buffer.from(svgContent))
  .resize(512, 512)
  .png()
  .toFile(pngPath)
  .then(() => {
    console.log('Logo converted to PNG successfully at:', pngPath);
  })
  .catch(err => {
    console.error('Error converting logo:', err);
  });
