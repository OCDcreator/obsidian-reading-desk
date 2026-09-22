import fs from 'fs';
import path from 'path';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const requiredScripts = {
	'check:project-docs': 'node scripts/check-project-docs.mjs',
	'check:owner-guard': 'node scripts/check-owner-guard.mjs',
	verify: 'npm run styles:sync && npm run check:project-docs && npm run check:owner-guard && npm run version:check && npm run lint && npm test && npm run build'
};

const requiredDocs = [
	{
		file: 'AGENTS.md',
		needles: [
			'npm run verify',
			'npm run check:project-docs',
			'npm run check:owner-guard',
			'Single-Responsibility Rule',
			'Documentation Gate'
		]
	},
	{
		file: 'CLAUDE.md',
		needles: [
			'@AGENTS.md'
		]
	}
];

const failures = [];

const styleSource = path.join(root, 'assets/styles.css');
const styleOutput = path.join(root, 'styles.css');
if (!fs.existsSync(styleSource)) failures.push('assets/styles.css is missing');
if (!fs.existsSync(styleOutput)) failures.push('styles.css build output is missing; run npm run styles:sync');
if (fs.existsSync(styleSource) && fs.existsSync(styleOutput)
	&& !fs.readFileSync(styleSource).equals(fs.readFileSync(styleOutput))) {
	failures.push('styles.css must be regenerated from assets/styles.css by the build');
}

for (const [scriptName, expectedCommand] of Object.entries(requiredScripts)) {
	if (packageJson.scripts?.[scriptName] !== expectedCommand) {
		failures.push(`package.json script ${scriptName} must be: ${expectedCommand}`);
	}
}

for (const doc of requiredDocs) {
	const filePath = path.join(root, doc.file);
	if (!fs.existsSync(filePath)) {
		failures.push(`${doc.file} is missing`);
		continue;
	}

	const content = fs.readFileSync(filePath, 'utf8');
	for (const needle of doc.needles) {
		if (!content.includes(needle)) {
			failures.push(`${doc.file} must mention ${needle}`);
		}
	}
}

if (failures.length > 0) {
	console.error('Project documentation gate failed:');
	failures.forEach(failure => console.error(`- ${failure}`));
	process.exit(1);
}

console.log('Project documentation gate passed.');
