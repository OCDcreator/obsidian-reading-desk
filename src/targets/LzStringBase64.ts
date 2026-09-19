/*
 * Minimal, dependency-free LZ-String Base64 decoder compatible with the
 * Excalidraw plugin's `compressed-json` serialization.  It is intentionally
 * decode-only: after a safe edit, the target is emitted as ordinary `json`, a
 * format the same plugin natively opens and saves.
 */
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

interface BitStream {
	value: number;
	position: number;
	index: number;
}

function base64Value(character: string): number {
	const value = BASE64.indexOf(character);
	if (value < 0) throw new Error('compressed-json 包含无效 Base64 字符。');
	return value;
}

function readBits(stream: BitStream, width: number, input: string): number {
	let bits = 0;
	let power = 1;
	const maxPower = 2 ** width;
	while (power !== maxPower) {
		const bit = stream.value & stream.position;
		stream.position >>= 1;
		if (stream.position === 0) {
			stream.position = 32;
			stream.value = stream.index < input.length ? base64Value(input.charAt(stream.index)) : 0;
			stream.index += 1;
		}
		bits |= (bit > 0 ? 1 : 0) * power;
		power <<= 1;
	}
	return bits;
}

/** Returns undefined for a malformed or truncated compressed document. */
export function decompressLzStringBase64(encoded: string): string | undefined {
	const input = encoded.replace(/[\r\n\s]/g, '');
	if (!input) return undefined;
	if (!/^[A-Za-z0-9+/=]+$/.test(input)) return undefined;
	const dictionary: string[] = ['0', '1', '2'];
	const stream: BitStream = { value: base64Value(input.charAt(0)), position: 32, index: 1 };
	let enlargeIn = 4;
	let dictionarySize = 4;
	let numBits = 3;
	const firstCode = readBits(stream, 2, input);
	let first: string;
	if (firstCode === 0) first = String.fromCharCode(readBits(stream, 8, input));
	else if (firstCode === 1) first = String.fromCharCode(readBits(stream, 16, input));
	else return firstCode === 2 ? '' : undefined;
	dictionary[3] = first;
	let word = first;
	const result = [first];

	while (stream.index <= input.length) {
		let code = readBits(stream, numBits, input);
		if (code === 0 || code === 1) {
			const width = code === 0 ? 8 : 16;
			dictionary[dictionarySize] = String.fromCharCode(readBits(stream, width, input));
			code = dictionarySize;
			dictionarySize += 1;
			enlargeIn -= 1;
		} else if (code === 2) {
			return result.join('');
		}
		if (enlargeIn === 0) {
			enlargeIn = 2 ** numBits;
			numBits += 1;
		}
		const entry = dictionary[code] ?? (code === dictionarySize ? `${word}${word.charAt(0)}` : undefined);
		if (entry === undefined) return undefined;
		result.push(entry);
		dictionary[dictionarySize] = `${word}${entry.charAt(0)}`;
		dictionarySize += 1;
		enlargeIn -= 1;
		word = entry;
		if (enlargeIn === 0) {
			enlargeIn = 2 ** numBits;
			numBits += 1;
		}
	}
	return undefined;
}
