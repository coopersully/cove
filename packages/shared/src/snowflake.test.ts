import { describe, expect, it } from "vitest";

import { compareSnowflakes, configureWorker, generateSnowflake, snowflakeTimestamp } from "./snowflake.js";

describe("generateSnowflake", () => {
	it("returns a numeric string", () => {
		const id = generateSnowflake();
		expect(id).toMatch(/^\d+$/);
	});

	it("returns unique IDs on consecutive calls", () => {
		const a = generateSnowflake();
		const b = generateSnowflake();
		expect(a).not.toBe(b);
	});
});

describe("snowflakeTimestamp", () => {
	it("extracts a recent timestamp", () => {
		const id = generateSnowflake();
		const ts = snowflakeTimestamp(id);
		const now = Date.now();
		expect(ts.getTime()).toBeLessThanOrEqual(now);
		expect(ts.getTime()).toBeGreaterThan(now - 5000);
	});
});

describe("compareSnowflakes", () => {
	it("returns negative when a < b", () => {
		const a = generateSnowflake();
		const b = generateSnowflake();
		expect(compareSnowflakes(a, b)).toBe(-1);
	});

	it("returns positive when a > b", () => {
		const a = generateSnowflake();
		const b = generateSnowflake();
		expect(compareSnowflakes(b, a)).toBe(1);
	});

	it("returns 0 for equal IDs", () => {
		const a = generateSnowflake();
		expect(compareSnowflakes(a, a)).toBe(0);
	});
});

describe("configureWorker", () => {
	it("rejects negative worker ID", () => {
		expect(() => configureWorker(-1)).toThrow();
	});

	it("rejects worker ID above max", () => {
		expect(() => configureWorker(32)).toThrow();
	});

	it("accepts valid worker ID", () => {
		expect(() => configureWorker(0)).not.toThrow();
	});
});
