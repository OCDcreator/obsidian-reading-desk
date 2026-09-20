export interface CopyableReaderPage {
	canCopyCurrentPage(): boolean;
	copyCurrentPageLink(): Promise<void>;
}

export function canCopyReaderPage(reader: CopyableReaderPage | null | undefined): boolean {
	return reader?.canCopyCurrentPage() === true;
}

export async function executeCopyReaderPage(
	reader: CopyableReaderPage,
	reportFailure: (message: string) => void
): Promise<boolean> {
	try {
		await reader.copyCurrentPageLink();
		return true;
	} catch (error) {
		const detail = error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)
			? error.message
			: '无法写入剪贴板，请检查系统权限后重试。';
		reportFailure(`复制失败：${detail}`);
		return false;
	}
}
