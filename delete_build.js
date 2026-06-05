const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const curPath = path.join(directoryPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

const pathsToDelete = [
  path.join(__dirname, 'android', 'app', 'build'),
  path.join(__dirname, 'android', 'build'),
  path.join(__dirname, 'android', 'app', '.cxx'),
];

// Add node_modules native build directories
const nodeModulesDir = path.join(__dirname, 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  fs.readdirSync(nodeModulesDir).forEach(dir => {
    const pkgAndroidBuild = path.join(nodeModulesDir, dir, 'android', 'build');
    if (fs.existsSync(pkgAndroidBuild)) {
      pathsToDelete.push(pkgAndroidBuild);
    }
    const pkgAndroidCxx = path.join(nodeModulesDir, dir, 'android', '.cxx');
    if (fs.existsSync(pkgAndroidCxx)) {
      pathsToDelete.push(pkgAndroidCxx);
    }

    // Handle scoped packages like @react-native
    if (dir.startsWith('@')) {
      const scopedDir = path.join(nodeModulesDir, dir);
      fs.readdirSync(scopedDir).forEach(subDir => {
        const scopedAndroidBuild = path.join(scopedDir, subDir, 'android', 'build');
        if (fs.existsSync(scopedAndroidBuild)) {
          pathsToDelete.push(scopedAndroidBuild);
        }
        const scopedAndroidCxx = path.join(scopedDir, subDir, 'android', '.cxx');
        if (fs.existsSync(scopedAndroidCxx)) {
          pathsToDelete.push(scopedAndroidCxx);
        }
      });
    }
  });
}

pathsToDelete.forEach(p => {
  console.log('Deleting:', p);
  try {
    deleteFolderRecursive(p);
    console.log('Deleted successfully:', p);
  } catch (e) {
    console.error('Error deleting:', p, e.message);
  }
});
