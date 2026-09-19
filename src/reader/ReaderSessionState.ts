export interface SerializedReaderState {
	pdfPath?: string;
	page?: number;
}

/** Minimal, testable state that survives a workspace view restore and source moves. */
export class ReaderSessionState {
	private pdfPath = '';
	private page = 1;

	open(path: string, page = 1): void {
		this.pdfPath = path;
		this.page = Math.max(1, Math.round(page));
	}

	path(): string { return this.pdfPath; }
	pageNumber(): number { return this.page; }
	setPage(page: number): void { this.page = Math.max(1, Math.round(page)); }

	rename(oldPath: string, newPath: string): boolean {
		if (this.pdfPath !== oldPath) return false;
		this.pdfPath = newPath;
		return true;
	}

	delete(path: string): boolean {
		if (this.pdfPath !== path) return false;
		this.pdfPath = '';
		this.page = 1;
		return true;
	}

	serialize(): SerializedReaderState {
		return this.pdfPath ? { pdfPath: this.pdfPath, page: this.page } : {};
	}

	restore(state: unknown): void {
		const value = state as SerializedReaderState | null;
		if (typeof value?.pdfPath !== 'string' || !value.pdfPath) return;
		this.open(value.pdfPath, value.page);
	}
}
