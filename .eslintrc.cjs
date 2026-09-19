module.exports = {
	root: true,
	env: {
		browser: true,
		node: true,
		es2021: true
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module'
	},
	plugins: ['@typescript-eslint'],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended'
	],
	ignorePatterns: [
		'lib/',
		'main.js',
		'node_modules/',
		'automation/runtime/'
	],
	overrides: [
		{
			files: ['src/**/*.ts'],
			rules: {
				'max-lines': ['warn', {
					max: 650,
					skipBlankLines: true,
					skipComments: true
				}],
				'max-lines-per-function': ['warn', {
					max: 220,
					skipBlankLines: true,
					skipComments: true
				}]
			}
		},
		{
			files: ['test/**/*.ts'],
			globals: {
				afterEach: 'readonly',
				beforeEach: 'readonly',
				describe: 'readonly',
				expect: 'readonly',
				it: 'readonly',
				vi: 'readonly'
			}
		}
	],
	rules: {
		'@typescript-eslint/no-unused-vars': ['error', {
			argsIgnorePattern: '^_',
			ignoreRestSiblings: true,
			varsIgnorePattern: '^_'
		}]
	}
};
