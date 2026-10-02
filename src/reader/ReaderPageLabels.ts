/** Printed labels never replace the physical page used by links and annotations. */
export class ReaderPageLabels {
	constructor(private readonly labels: readonly string[] = []) { }
	label(page: number): string { return this.labels[page - 1]?.trim() || String(page); }
	description(page: number): string { const label = this.label(page); return label === String(page) ? `第 ${page} 页` : `第 ${label} 页（PDF 第 ${page} 页）`; }
	resolve(value: string, count: number): { page?: number; message?: string } {
		const query = value.trim();
		if (/^#\d+$/.test(query)) return this.physical(Number(query.slice(1)), count);
		const matches: number[] = [];
		for (let page = 1; page <= count; page += 1) if (this.label(page) === query) matches.push(page);
		if (matches.length === 1) return { page: matches[0] };
		if (matches.length > 1) return { message: `页码「${query}」对应多页，请输入 ${matches.map(page => `#${page}`).join('、')} 选择物理页。` };
		if (/^\d+$/.test(query)) return this.physical(Number(query), count);
		return { message: '没有找到此页码。可输入印刷页码，或用 # 加数字指定 PDF 物理页。' };
	}
	private physical(page: number, count: number): { page?: number; message?: string } {
		return Number.isSafeInteger(page) && page >= 1 && page <= count ? { page } : { message: `PDF 物理页应在 1–${count} 之间。` };
	}
}
