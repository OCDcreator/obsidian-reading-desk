import type { PageViewport } from 'pdfjs-dist';
/** Matches PDF.js quarter-turn transform on a 200x100 point page. */
export function testViewport(rotation = 0, scale = 1): PageViewport {
	const width = (rotation % 180 ? 100 : 200) * scale;
	const height = (rotation % 180 ? 200 : 100) * scale;
	const toView = (x: number, y: number): number[] => {
		if (rotation === 90) return [y * scale, x * scale];
		if (rotation === 180) return [(200 - x) * scale, y * scale];
		if (rotation === 270) return [(100 - y) * scale, (200 - x) * scale];
		return [x * scale, (100 - y) * scale];
	};
	const toPdf = (x: number, y: number): number[] => {
		if (rotation === 90) return [y / scale, x / scale];
		if (rotation === 180) return [200 - x / scale, y / scale];
		if (rotation === 270) return [200 - y / scale, 100 - x / scale];
		return [x / scale, 100 - y / scale];
	};
	return { width, height, viewBox: [0, 0, 200, 100], scale, rotation,
		convertToPdfPoint: toPdf, convertToViewportPoint: toView,
		convertToViewportRectangle: (rect: number[]) => [...toView(rect[0], rect[1]), ...toView(rect[2], rect[3])],
		clone: () => testViewport(rotation, scale)
	} as unknown as PageViewport;
}
