/**
 * The only filesystem contract used by target adapters.  The Obsidian-facing
 * composition layer supplies this with vault reads and a vault-level atomic
 * write implementation (normally `Vault.process`).
 */
export interface FileGateway {
	/**
	 * Runs the transform against the latest vault contents and persists its
	 * result as one atomic operation. In Obsidian this maps to Vault.process.
	 */
	atomicTransform(path: string, transformer: (current: string) => string): Promise<void>;
}
