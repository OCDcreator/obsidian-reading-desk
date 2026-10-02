/** Shared abort boundary for page extraction, navigation and PDF rasterization. */
export function readerAbortError(): Error {
	const error = new Error('阅读请求已取消');
	error.name = 'AbortError';
	return error;
}
export function throwIfReaderAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw readerAbortError();
}
export function isReaderAbort(error: unknown): boolean {
	return error instanceof Error && (error.name === 'AbortError' || error.name === 'RenderingCancelledException');
}
/** Stops waiting immediately, even when PDF.js cannot abort text extraction. */
export function abortableReaderTask<T>(task: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return task;
	if (signal.aborted) return Promise.reject(readerAbortError());
	return new Promise<T>((resolve, reject) => {
		const abort = (): void => reject(readerAbortError());
		signal.addEventListener('abort', abort, { once: true });
		task.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}
