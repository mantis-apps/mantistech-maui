// rename-ts-files.js
const fs = require('fs');
const path = require('path');

function renameFiles(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      renameFiles(filePath); // Recurse into subdirectories
    } else if (path.extname(file) === '.ts' && !file.endsWith('.template')) {
      const newPath = filePath + '.template';
      fs.renameSync(filePath, newPath);
      console.log(`Renamed: ${filePath} -> ${newPath}`);
    }
  });
}

const spartanUiDir = path.join(__dirname, 'src', 'generators', 'maui', 'files', 'spartanui');
renameFiles(spartanUiDir);

console.log('File renaming complete.');
