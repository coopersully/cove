import { describe, expect, it } from "vitest";

import { ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, Permissions, hasPermission } from "./permissions.js";

describe("hasPermission", () => {
	it("returns true when permission is set", () => {
		expect(hasPermission(Permissions.SEND_MESSAGES, Permissions.SEND_MESSAGES)).toBe(true);
	});

	it("returns false when permission is not set", () => {
		expect(hasPermission(Permissions.SEND_MESSAGES, Permissions.MANAGE_SERVER)).toBe(false);
	});

	it("ADMINISTRATOR bypasses all checks", () => {
		expect(hasPermission(Permissions.ADMINISTRATOR, Permissions.MANAGE_SERVER)).toBe(true);
		expect(hasPermission(Permissions.ADMINISTRATOR, Permissions.MANAGE_ROLES)).toBe(true);
	});

	it("works with combined permissions", () => {
		const combined = Permissions.SEND_MESSAGES | Permissions.READ_MESSAGES;
		expect(hasPermission(combined, Permissions.SEND_MESSAGES)).toBe(true);
		expect(hasPermission(combined, Permissions.READ_MESSAGES)).toBe(true);
		expect(hasPermission(combined, Permissions.MANAGE_CHANNELS)).toBe(false);
	});

	it("checks multiple permissions at once", () => {
		const required = Permissions.SEND_MESSAGES | Permissions.READ_MESSAGES;
		const hasBoth = Permissions.SEND_MESSAGES | Permissions.READ_MESSAGES | Permissions.CONNECT;
		const hasOne = Permissions.SEND_MESSAGES;

		expect(hasPermission(hasBoth, required)).toBe(true);
		expect(hasPermission(hasOne, required)).toBe(false);
	});
});

describe("DEFAULT_EVERYONE_PERMISSIONS", () => {
	it("includes SEND_MESSAGES, READ_MESSAGES, and CONNECT", () => {
		expect(hasPermission(DEFAULT_EVERYONE_PERMISSIONS, Permissions.SEND_MESSAGES)).toBe(true);
		expect(hasPermission(DEFAULT_EVERYONE_PERMISSIONS, Permissions.READ_MESSAGES)).toBe(true);
		expect(hasPermission(DEFAULT_EVERYONE_PERMISSIONS, Permissions.CONNECT)).toBe(true);
	});

	it("does not include admin permissions", () => {
		expect(hasPermission(DEFAULT_EVERYONE_PERMISSIONS, Permissions.ADMINISTRATOR)).toBe(false);
		expect(hasPermission(DEFAULT_EVERYONE_PERMISSIONS, Permissions.MANAGE_SERVER)).toBe(false);
	});
});

describe("ALL_PERMISSIONS", () => {
	it("includes every permission", () => {
		for (const perm of Object.values(Permissions)) {
			expect(hasPermission(ALL_PERMISSIONS, perm)).toBe(true);
		}
	});
});
