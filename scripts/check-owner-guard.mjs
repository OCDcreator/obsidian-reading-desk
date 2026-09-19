import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const maxSourceLines = 650;
const reviewBandLines = 400;
const failures = [];
const reviewBandHits = [];

function walk(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			walk(entryPath);
			continue;
		}

		if (!entry.name.endsWith('.ts')) {
			continue;
		}

		checkSourceFile(entryPath);
	}
}

function checkSourceFile(filePath) {
	const repoRelativePath = path.relative(root, filePath);
	const lineCount = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;

	if (lineCount > maxSourceLines) {
		failures.push(`${repoRelativePath} has ${lineCount} lines; split before exceeding ${maxSourceLines}`);
		return;
	}

	if (lineCount > reviewBandLines) {
		reviewBandHits.push(`${repoRelativePath} has ${lineCount} lines; confirm it still owns one behavior slice`);
	}
}

if (!fs.existsSync(sourceRoot)) {
	console.error('Owner guard failed: src/ is missing.');
	process.exit(1);
}

walk(sourceRoot);

if (reviewBandHits.length > 0) {
	console.log('Owner guard review band notices:');
	reviewBandHits.forEach(hit => console.log(`- ${hit}`));
}

if (failures.length > 0) {
	console.error('Owner guard failed:');
	failures.forEach(failure => console.error(`- ${failure}`));
	process.exit(1);
}

console.log('Owner guard passed.');
