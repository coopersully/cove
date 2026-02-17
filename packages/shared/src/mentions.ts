export interface ParsedMentions {
  userIds: string[];
  roleIds: string[];
}

/**
 * Parse <@userId> and <@&roleId> mentions from message content.
 * Ignores mentions inside inline code (`...`) and fenced code blocks (```...```).
 */
export function parseMentions(content: string): ParsedMentions {
  // Strip fenced code blocks
  const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, "");
  // Strip inline code
  const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, "");

  const userIds = new Set<string>();
  const roleIds = new Set<string>();

  // Match user mentions: <@123>
  for (const match of withoutInlineCode.matchAll(/<@(\d+)>/g)) {
    const userId = match[1];
    if (userId) {
      userIds.add(userId);
    }
  }

  // Match role mentions: <@&123>
  for (const match of withoutInlineCode.matchAll(/<@&(\d+)>/g)) {
    const roleId = match[1];
    if (roleId) {
      roleIds.add(roleId);
    }
  }

  return {
    userIds: [...userIds],
    roleIds: [...roleIds],
  };
}
