import fs from 'fs';

const source = new URL('../assets/styles.css', import.meta.url);
const output = new URL('../styles.css', import.meta.url);
fs.copyFileSync(source, output);
