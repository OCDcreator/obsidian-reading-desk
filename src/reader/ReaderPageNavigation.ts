export interface BoundedVisiblePage {
	page: number;
	notice?: string;
}

export function boundVisiblePage(requested: number, pageCount: number): BoundedVisiblePage {
	const rounded = Number.isFinite(requested) ? Math.round(requested) : 1;
	const page = Math.max(1, Math.min(Math.max(pageCount, 1), rounded));
	return rounded === page ? { page } : { page, notice: `页码超出范围，已改为第 ${page} 页。` };
}
