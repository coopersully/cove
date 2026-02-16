import { describe, expect, it } from "vitest";

import {
	channelTypeSchema,
	emailSchema,
	messageContentSchema,
	passwordSchema,
	snowflakeSchema,
	usernameSchema,
} from "./validators.js";
import { sendFriendRequestSchema } from "./schemas.js";

function expectPass(schema: { parse: (v: unknown) => unknown }, value: unknown) {
	expect(() => schema.parse(value)).not.toThrow();
}

function expectFail(schema: { parse: (v: unknown) => unknown }, value: unknown) {
	expect(() => schema.parse(value)).toThrow();
}

describe("snowflakeSchema", () => {
	it("accepts valid numeric strings", () => {
		expectPass(snowflakeSchema, "123456789012345678");
	});

	it("rejects non-numeric strings", () => {
		expectFail(snowflakeSchema, "abc");
		expectFail(snowflakeSchema, "123abc");
		expectFail(snowflakeSchema, "");
	});
});

describe("usernameSchema", () => {
	it("accepts valid usernames", () => {
		expectPass(usernameSchema, "alice");
		expectPass(usernameSchema, "Bob_42");
	});

	it("rejects too short", () => {
		expectFail(usernameSchema, "ab");
	});

	it("rejects too long", () => {
		expectFail(usernameSchema, "a".repeat(33));
	});

	it("rejects special characters", () => {
		expectFail(usernameSchema, "alice!");
		expectFail(usernameSchema, "alice bob");
	});
});

describe("emailSchema", () => {
	it("accepts valid emails", () => {
		expectPass(emailSchema, "test@example.com");
	});

	it("rejects invalid emails", () => {
		expectFail(emailSchema, "notanemail");
		expectFail(emailSchema, "@no-user.com");
	});
});

describe("passwordSchema", () => {
	it("accepts valid passwords", () => {
		expectPass(passwordSchema, "Password1");
	});

	it("rejects too short", () => {
		expectFail(passwordSchema, "Pass1");
	});

	it("rejects missing uppercase", () => {
		expectFail(passwordSchema, "password1");
	});

	it("rejects missing lowercase", () => {
		expectFail(passwordSchema, "PASSWORD1");
	});

	it("rejects missing number", () => {
		expectFail(passwordSchema, "Passwordd");
	});
});

describe("channelTypeSchema", () => {
	it("accepts text, voice, dm", () => {
		expectPass(channelTypeSchema, "text");
		expectPass(channelTypeSchema, "voice");
		expectPass(channelTypeSchema, "dm");
	});

	it("rejects invalid types", () => {
		expectFail(channelTypeSchema, "video");
		expectFail(channelTypeSchema, "");
	});
});

describe("messageContentSchema", () => {
	it("accepts valid messages", () => {
		expectPass(messageContentSchema, "Hello!");
	});

	it("rejects empty messages", () => {
		expectFail(messageContentSchema, "");
	});

	it("rejects messages over 4000 chars", () => {
		expectFail(messageContentSchema, "a".repeat(4001));
	});
});

describe("sendFriendRequestSchema", () => {
	it("accepts valid username", () => {
		expectPass(sendFriendRequestSchema, { username: "alice" });
	});

	it("rejects missing username", () => {
		expectFail(sendFriendRequestSchema, {});
	});

	it("rejects invalid username", () => {
		expectFail(sendFriendRequestSchema, { username: "a!" });
	});
});
