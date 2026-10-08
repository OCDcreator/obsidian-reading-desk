import { requestUrl } from 'obsidian';
import type { DoubanTransport, DoubanTransportResponse } from '../library/metadata/DoubanClient';

/** Routes Douban requests through Obsidian requestUrl so desktop CORS does not apply; headers (Referer) pass through. */
export class DoubanRequestTransport implements DoubanTransport {
	async get(url: string, headers: Record<string, string>, binary = false): Promise<DoubanTransportResponse> {
		const response = await requestUrl({ url, method: 'GET', headers, throw: false });
		return { status: response.status, text: binary ? undefined : response.text, binary: binary ? response.arrayBuffer : undefined };
	}
}
