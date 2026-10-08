import { describe, expect, it } from 'vitest';
import { DoubanBlockedError, DoubanClient, DoubanRequestError, type DoubanTransport } from '../../../src/library/metadata/DoubanClient';

const SUBJECT_HTML = `<!DOCTYPE html>
<html><head>
<meta property="og:title" content="人间词话" />
<meta property="og:image" content="https://img2.doubanio.com/view/subject/l/public/s1146614.jpg" />
<script type="application/ld+json">
{
  "@context":"http://schema.org",
  "@type":"Book",
  "name" : "人间词话",
  "author": [ { "@type": "Person", "name": "王国维" } ],
  "url" : "https://book.douban.com/subject/1203426/",
  "isbn" : "9787020123456"
}
</script>
</head><body>
<div id="info" class="">
 <span> <span class="pl"> 作者</span>: <a href="/search/%E7%8E%8B%E5%9B%BD%E7%BB%B4">王国维</a> </span><br/>
 <span class="pl">出版社:</span> <a href="https://book.douban.com/press/2541">中华书局</a> <br>
 <span class="pl">出版年:</span> 2009-12<br/>
 <span class="pl">页数:</span> 216<br/>
 <span class="pl">译者:</span> <a href="/search/y">叶嘉莹</a><br/>
 <span class="pl">丛书:</span> <a href="https://book.douban.com/series/12">中华经典藏书</a><br/>
 <span class="pl">ISBN:</span> 9787020123456<br/>
</div>
<strong class="ll rating_num " > 9.0 </strong>
</body></html>`;

const SUBJECT_HTML_NO_LD = `<html><head></head><body>
<div id="info">
 <span class="pl">作者:</span> 鲁迅 / 周作人<br/>
 <span class="pl">页数:</span> 不详<br/>
</div>
<strong class="ll rating_num " >  </strong>
</body></html>`;

function transport(routes: Array<{ match: RegExp; status?: number; text?: string; binary?: ArrayBuffer }>, calls: string[] = []): { transport: DoubanTransport; calls: string[]; headers: Record<string, string>[] } {
	const headers: Record<string, string>[] = [];
	return {
		calls, headers,
		transport: {
			get: async (url, requestHeaders, binary) => {
				calls.push(url);
				headers.push(requestHeaders);
				const route = routes.find(item => item.match.test(url));
				if (!route) return { status: 404 };
				return { status: route.status ?? 200, text: route.text, binary: binary ? route.binary : undefined };
			}
		}
	};
}

describe('DoubanClient', () => {
	it('parses subject_suggest JSON and keeps only book entries', async () => {
		const { transport: t, calls } = transport([{
			match: /subject_suggest/,
			text: JSON.stringify([
				{ title: '人间词话', url: 'https://book.douban.com/subject/1203426/', pic: 'https://img9.doubanio.com/s.jpg', author_name: '王国维', year: '1998', type: 'b', id: '1203426' },
				{ title: '人间词话（话剧）', type: 'm', id: '999' }
			])
		}]);
		const hits = await new DoubanClient(t).searchBooks('人间词话');
		expect(calls[0]).toContain('q=%E4%BA%BA%E9%97%B4%E8%AF%8D%E8%AF%9D');
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ id: '1203426', title: '人间词话', author: '王国维', year: '1998' });
	});

	it('parses subject pages through JSON-LD plus the info block, including rating and series', async () => {
		const { transport: t } = transport([{ match: /subject\/1203426/, text: SUBJECT_HTML }]);
		const detail = await new DoubanClient(t).fetchBook('1203426');
		expect(detail).toMatchObject({
			id: '1203426', title: '人间词话', authors: ['王国维'], translators: ['叶嘉莹'],
			publisher: '中华书局', publishYear: '2009-12', pageCount: 216,
			isbn: '9787020123456', series: '中华经典藏书', rating: 9,
			coverUrl: 'https://img2.doubanio.com/view/subject/l/public/s1146614.jpg'
		});
	});

	it('falls back to info-block authors when JSON-LD is absent and ignores non-numeric pages and empty rating', async () => {
		const { transport: t } = transport([{ match: /subject\/1/, text: SUBJECT_HTML_NO_LD }]);
		const detail = await new DoubanClient(t).fetchBook('1');
		expect(detail.authors).toEqual(['鲁迅', '周作人']);
		expect(detail.pageCount).toBeUndefined();
		expect(detail.rating).toBeUndefined();
	});

	it('rejects invalid subject IDs before any request', async () => {
		const { transport: t, calls } = transport([]);
		await expect(new DoubanClient(t).fetchBook('x;drop')).rejects.toThrow('无效的豆瓣条目 ID');
		expect(calls).toHaveLength(0);
	});

	it('maps HTTP 403 to the circuit-breaker error on search, detail and cover', async () => {
		const forbidden = transport([{ match: /.*/, status: 403 }]);
		const client = new DoubanClient(forbidden.transport);
		await expect(client.searchBooks('x')).rejects.toBeInstanceOf(DoubanBlockedError);
		await expect(client.fetchBook('1203426')).rejects.toBeInstanceOf(DoubanBlockedError);
		await expect(client.downloadCover('https://img2.doubanio.com/x.jpg', '1203426')).rejects.toBeInstanceOf(DoubanBlockedError);
	});

	it('maps other failures to request errors and rejects empty cover bodies', async () => {
		const failing = transport([{ match: /.*/, status: 500 }]);
		await expect(new DoubanClient(failing.transport).searchBooks('x')).rejects.toBeInstanceOf(DoubanRequestError);
		const empty = transport([{ match: /.*/, binary: new ArrayBuffer(0) }]);
		await expect(new DoubanClient(empty.transport).downloadCover('https://img2.doubanio.com/x.jpg', '1')).rejects.toBeInstanceOf(DoubanRequestError);
	});

	it('sends the subject page Referer when downloading covers', async () => {
		const data = new Uint8Array([1, 2, 3]).buffer;
		const { transport: t, headers } = transport([{ match: /doubanio/, binary: data }]);
		const result = await new DoubanClient(t).downloadCover('https://img2.doubanio.com/view/subject/l/public/s1146614.jpg', '1203426');
		expect(result.byteLength).toBe(3);
		expect(headers[0].Referer).toBe('https://book.douban.com/subject/1203426/');
	});
});
