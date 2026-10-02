export interface DataValidationIssue {
	path: string;
	message: string;
}

export class DataValidationError extends Error {
	readonly name = 'DataValidationError';
	constructor(readonly issues: DataValidationIssue[]) {
		super(`Reading Desk 数据校验失败：${issues.map(issue => `${issue.path}: ${issue.message}`).join('；')}`);
	}
}

export type ValueCheck = (value: unknown, path: string, check: ShapeCheck) => void;
export type Fields = Record<string, ValueCheck>;

/** Checks JSON shapes without casting malformed records into domain objects. */
export class ShapeCheck {
	readonly issues: DataValidationIssue[] = [];
	issue(path: string, message: string): void { this.issues.push({ path, message }); }

	object(value: unknown, path: string): value is Record<string, unknown> {
		if (isPlainObject(value)) return true;
		this.issue(path, '应为普通对象');
		return false;
	}

	fields(value: unknown, path: string, required: Fields, optional: Fields = {}): void {
		if (!this.object(value, path)) return;
		for (const [key, validator] of Object.entries(required)) validator(value[key], `${path}.${key}`, this);
		for (const [key, validator] of Object.entries(optional)) {
			if (value[key] !== undefined) validator(value[key], `${path}.${key}`, this);
		}
	}

	map(value: unknown, path: string, validator: ValueCheck): void {
		if (!this.object(value, path)) return;
		for (const [key, item] of Object.entries(value)) {
			if (!key || unsafeKey(key)) this.issue(`${path}.${key}`, '无效的记录键');
			validator(item, `${path}.${key}`, this);
			if (isPlainObject(item) && typeof item.id === 'string' && item.id !== key) {
				this.issue(`${path}.${key}.id`, '记录键与稳定 ID 不一致');
			}
		}
	}

	array(value: unknown, path: string, validator: ValueCheck): void {
		if (!Array.isArray(value)) { this.issue(path, '应为数组'); return; }
		value.forEach((item, index) => validator(item, `${path}[${index}]`, this));
	}

	finish(): void { if (this.issues.length) throw new DataValidationError(this.issues); }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

export const text: ValueCheck = (value, path, check) => {
	if (typeof value !== 'string') check.issue(path, '应为字符串');
};
export const nonEmptyText: ValueCheck = (value, path, check) => {
	text(value, path, check);
	if (typeof value === 'string' && !value.trim()) check.issue(path, '不能为空');
};
export const flag: ValueCheck = (value, path, check) => {
	if (typeof value !== 'boolean') check.issue(path, '应为布尔值');
};
export const texts: ValueCheck = (value, path, check) => check.array(value, path, text);

export function numeric(min = -Infinity, max = Infinity, integer = false): ValueCheck {
	return (value, path, check) => {
		if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
			check.issue(path, `应为${integer ? '整数' : '有限数值'}，范围 ${min}–${max}`);
		}
	};
}

export function choice(...values: (string | number)[]): ValueCheck {
	return (value, path, check) => {
		if (!values.includes(value as string | number)) check.issue(path, `应为 ${values.join(' / ')}`);
	};
}

export function shape(required: Fields, optional: Fields = {}): ValueCheck {
	return (value, path, check) => check.fields(value, path, required, optional);
}

export function unsafeKey(key: string): boolean {
	return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

/** Reject values that cannot survive a JSON persistence round trip, including unknown extension fields. */
export function checkJson(value: unknown, path: string, check: ShapeCheck, ancestors = new Set<object>()): void {
	if (value === undefined || value === null || typeof value === 'string' || typeof value === 'boolean') return;
	if (typeof value === 'number' && Number.isFinite(value)) return;
	if (!Array.isArray(value) && !isPlainObject(value)) { check.issue(path, '应为可保存的 JSON 数据'); return; }
	if (ancestors.has(value)) { check.issue(path, '不能包含循环引用'); return; }
	ancestors.add(value);
	for (const [key, item] of Object.entries(value)) {
		if (unsafeKey(key)) check.issue(`${path}.${key}`, '不安全的字段名');
		if (Array.isArray(value) && item === undefined) check.issue(`${path}.${key}`, '数组不能包含 undefined');
		checkJson(item, `${path}.${key}`, check, ancestors);
	}
	ancestors.delete(value);
}
