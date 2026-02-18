import { describe, expect, it } from "vitest";
import { parseMentions } from "./mentions.js";

describe("parseMentions", () => {
  it("extracts user mentions", () => {
    const result = parseMentions("Hello <@123456789> and <@987654321>");
    expect(result.userIds).toEqual(["123456789", "987654321"]);
    expect(result.roleIds).toEqual([]);
  });

  it("extracts role mentions", () => {
    const result = parseMentions("Hey <@&111222333>");
    expect(result.userIds).toEqual([]);
    expect(result.roleIds).toEqual(["111222333"]);
  });

  it("extracts both user and role mentions", () => {
    const result = parseMentions("<@111> said hello to <@&222>");
    expect(result.userIds).toEqual(["111"]);
    expect(result.roleIds).toEqual(["222"]);
  });

  it("deduplicates mentions", () => {
    const result = parseMentions("<@111> <@111> <@111>");
    expect(result.userIds).toEqual(["111"]);
  });

  it("ignores mentions inside inline code", () => {
    const result = parseMentions("Use `<@123>` syntax");
    expect(result.userIds).toEqual([]);
  });

  it("ignores mentions inside code blocks", () => {
    const result = parseMentions("```\n<@123>\n```");
    expect(result.userIds).toEqual([]);
  });

  it("returns empty arrays for no mentions", () => {
    const result = parseMentions("Just a normal message");
    expect(result.userIds).toEqual([]);
    expect(result.roleIds).toEqual([]);
  });

  it("handles empty string", () => {
    const result = parseMentions("");
    expect(result.userIds).toEqual([]);
    expect(result.roleIds).toEqual([]);
  });
});
