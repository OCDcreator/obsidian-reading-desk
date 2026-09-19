import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: fileURLToPath(new URL('./test/support/obsidian-runtime.ts', import.meta.url))
		}
	},
	test: {
		environment: 'node',
		include: ['test/**/*.test.ts'],
		restoreMocks: true,
		clearMocks: true
	}
});
