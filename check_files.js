const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (file.includes('node_modules') || file.includes('.git') || file.includes('.next')) {
                return;
            }
            results = results.concat(walk(file));
        } else {
            results.push({ path: file, size: stat.size });
        }
    });
    return results;
}

const files = walk('.');
files.forEach(f => {
    console.log(`${f.size} ${f.path}`);
});
