export interface ReaderOpenToken { generation: number; path: string; }

/** Assigns document ownership before asynchronous PDF opening begins. */
export class ReaderOpenRequests {
	private generation = 0;
	begin(path: string): ReaderOpenToken { return { generation: ++this.generation, path }; }
	isCurrent(token: ReaderOpenToken): boolean { return token.generation === this.generation; }
	invalidate(): void { this.generation += 1; }
}
