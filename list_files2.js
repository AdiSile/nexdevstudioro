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
            results.push(file);
        }
    });
    return results;
}

const files = walk('.');
fs.writeFileSync('all_files.txt', files.join('\n'), 'utf8');
console.log('Done');
