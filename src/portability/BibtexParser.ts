export interface BibtexEntry {
	citationKey: string;
	fields: Record<string, string>;
}

/** Local data parser. TeX commands remain data; no evaluation, shell or network calls. */
export class BibtexParser {
	private position = 0;
	private readonly strings = new Map<string, string>(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map((month, index) => [month, String(index + 1)]));

	constructor(private readonly text: string) { }

	parse(): BibtexEntry[] {
		const entries: BibtexEntry[] = [];
		while (this.skipSpace(), this.position < this.text.length) {
			this.expect('@');
			const type = this.identifier().toLowerCase();
			this.skipSpace();
			const opening = this.text[this.position++];
			if (opening !== '{' && opening !== '(') this.fail('条目缺少起始括号');
			const closing = opening === '{' ? '}' : ')';
			if (type === 'comment') { this.skipBlock(opening, closing); continue; }
			if (type === 'preamble') { this.value(); this.skipSpace(); this.expect(closing); continue; }
			if (type === 'string') {
				this.skipSpace();
				const name = this.identifier().toLowerCase();
				this.skipSpace(); this.expect('=');
				this.strings.set(name, this.value());
				this.skipSpace();
				if (this.text[this.position] === ',') this.position++;
				this.skipSpace(); this.expect(closing);
				continue;
			}
			this.skipSpace();
			const keyStart = this.position;
			while (this.position < this.text.length && ![',', closing].includes(this.text[this.position])) this.position++;
			const citationKey = this.text.slice(keyStart, this.position).trim();
			if (!citationKey || /\s/.test(citationKey)) this.fail('缺少或无效的 citation key');
			this.expect(',');
			const fields: Record<string, string> = Object.create(null) as Record<string, string>;
			while (this.skipSpace(), this.text[this.position] !== closing) {
				const name = this.identifier().toLowerCase();
				if (Object.prototype.hasOwnProperty.call(fields, name)) this.fail(`重复字段 ${name}`);
				this.skipSpace(); this.expect('=');
				fields[name] = this.value();
				this.skipSpace();
				if (this.text[this.position] !== closing) this.expect(',');
			}
			this.expect(closing);
			entries.push({ citationKey, fields });
			if (entries.length > 20000) this.fail('条目数超过 20000');
		}
		if (!entries.length) this.fail('没有可导入的 BibTeX 条目');
		return entries;
	}

	private value(): string {
		const parts: string[] = [];
		do {
			this.skipSpace();
			const char = this.text[this.position];
			if (char === '{' || char === '"') {
				this.position++;
				parts.push(this.delimitedValue(char));
			} else {
				const token = this.identifier();
				if (/^\d+$/.test(token)) parts.push(token);
				else if (this.strings.has(token.toLowerCase())) parts.push(this.strings.get(token.toLowerCase()) ?? '');
				else this.fail(`未定义的字符串 ${token}`);
			}
			this.skipSpace();
			if (this.text[this.position] !== '#') break;
			this.position++;
		} while (this.position < this.text.length);
		return parts.join('');
	}

	private delimitedValue(opening: string): string {
		let depth = opening === '{' ? 1 : 0;
		let value = '';
		while (this.position < this.text.length) {
			const char = this.text[this.position++];
			if (char === '\\') {
				if (this.position >= this.text.length) this.fail('未结束的转义字符');
				value += char + this.text[this.position++];
				continue;
			}
			if (char === '{') depth++;
			if (char === '}') {
				depth--;
				if (opening === '{' && depth === 0) return value;
				if (depth < 0) this.fail('字段括号不匹配');
			}
			if (char === '"' && opening === '"' && depth === 0) return value;
			value += char;
		}
		return this.fail('未结束的字段值');
	}

	private skipBlock(opening: string, closing: string): void {
		let depth = 1;
		while (this.position < this.text.length) {
			const char = this.text[this.position++];
			if (char === '\\') { this.position++; continue; }
			if (char === opening) depth++;
			if (char === closing && --depth === 0) return;
			if (char === closing) continue;
		}
		this.fail('未结束的注释');
	}

	private identifier(): string {
		const start = this.position;
		while (/[\w:./+-]/.test(this.text[this.position] ?? '') && this.position < this.text.length) this.position++;
		if (start === this.position) this.fail('缺少字段名或值');
		return this.text.slice(start, this.position);
	}

	private skipSpace(): void {
		while (this.position < this.text.length) {
			if (/\s/.test(this.text[this.position])) this.position++;
			else if (this.text[this.position] === '%') {
				while (this.position < this.text.length && this.text[this.position] !== '\n') this.position++;
			} else return;
		}
	}

	private expect(char: string): void {
		if (this.text[this.position] !== char) this.fail(`预期 ${char}`);
		this.position++;
	}

	private fail(message: string): never { throw new Error(`BibTeX 第 ${this.position + 1} 字符：${message}`); }
}

export function bibtexPlainText(value: string): string {
	return value
		.replace(/\\(?:textit|textbf|emph|textrm|textsc)\s*\{/g, '{')
		.replace(/\\([%&_#$])/g, '$1')
		.replace(/[{}]/g, '')
		.replace(/\s+/g, ' ').trim();
}

/** Splits name/file delimiters outside braces and preserves escaped delimiters. */
export function bibtexSplit(value: string, delimiter: RegExp): string[] {
	const parts: string[] = [];
	let start = 0;
	let depth = 0;
	for (let index = 0; index < value.length; index++) {
		if (value[index] === '\\') { index++; continue; }
		if (value[index] === '{') depth++;
		if (value[index] === '}') depth--;
		if (depth) continue;
		const match = value.slice(index).match(delimiter);
		if (!match || match.index !== 0) continue;
		parts.push(value.slice(start, index));
		index += match[0].length - 1;
		start = index + 1;
	}
	parts.push(value.slice(start));
	return parts;
}
