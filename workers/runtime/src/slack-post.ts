import type { ReportContent } from "@openchief/shared";

/** Slack block-kit section block limit */
const MAX_BLOCK_TEXT = 3000;

/**
 * Convert standard markdown (from Claude output) to Slack mrkdwn format.
 *
 * Handles: **bold** → *bold*, [text](url) → <url|text>,
 *          ### headers → *bold lines*, ``` code blocks preserved.
 */
export function markdownToSlackMrkdwn(text: string): string {
  let result = text;

  // Convert markdown links [text](url) → <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Convert **bold** → *bold* (must come before italic conversion)
  // Use a non-greedy match and avoid converting already-single asterisks
  result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");

  // Convert __italic__ → _italic_ (rare but possible)
  result = result.replace(/__(.+?)__/g, "_$1_");

  // Convert ### Header / ## Header / # Header → *Header* (bold line)
  result = result.replace(/^#{1,3}\s+(.+)$/gm, "*$1*");

  return result;
}

/**
 * Build Slack block-kit blocks from mrkdwn text.
 * Splits into multiple section blocks if text exceeds 3000 char limit.
 */
function buildMrkdwnBlocks(
  text: string
): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];

  if (text.length <= MAX_BLOCK_TEXT) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text },
    });
    return blocks;
  }

  // Split at paragraph boundaries to stay within limit
  const paragraphs = text.split("\n\n");
  let chunk = "";

  for (const para of paragraphs) {
    const candidate = chunk ? `${chunk}\n\n${para}` : para;
    if (candidate.length > MAX_BLOCK_TEXT && chunk) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: chunk },
      });
      chunk = para.length > MAX_BLOCK_TEXT ? para.slice(0, MAX_BLOCK_TEXT) : para;
    } else if (candidate.length > MAX_BLOCK_TEXT) {
      // Single paragraph exceeds limit — truncate
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: para.slice(0, MAX_BLOCK_TEXT) },
      });
      chunk = "";
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: chunk },
    });
  }

  return blocks;
}

/**
 * Post a message to a Slack channel using chat.postMessage with block-kit.
 * Uses mrkdwn blocks for proper formatting, with text as notification fallback.
 */
export async function postToSlack(
  token: string,
  channel: string,
  text: string,
  threadTs?: string
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const blocks = buildMrkdwnBlocks(text);

  const body: Record<string, unknown> = {
    channel,
    text, // fallback for notifications / unfurling
    blocks,
  };
  if (threadTs) {
    body.thread_ts = threadTs;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const result = (await response.json()) as {
    ok: boolean;
    ts?: string;
    error?: string;
  };

  if (!result.ok) {
    console.error(`Slack postMessage error: ${result.error}`);
  }

  return result;
}

/**
 * Format a meeting report as a Slack summary message.
 * Returns the main message and a transcript for the thread.
 */
export function formatMeetingForSlack(
  content: ReportContent,
  reportId: string
): { summary: string; transcript: string | null } {
  const parts: string[] = [];

  // Header
  const healthEmoji =
    content.healthSignal === "green"
      ? ":large_green_circle:"
      : content.healthSignal === "yellow"
        ? ":large_yellow_circle:"
        : ":red_circle:";
  parts.push(`${healthEmoji} *Daily Executive Meeting*`);
  parts.push(`> ${content.headline}`);
  parts.push("");

  // Strategic priorities
  const priorities = content.sections.find(
    (s) => s.name === "strategic-priorities"
  );
  if (priorities) {
    parts.push("*Strategic Priorities*");
    parts.push(markdownToSlackMrkdwn(priorities.body));
    parts.push("");
  }

  // Daily focus
  const focus = content.sections.find((s) => s.name === "daily-focus");
  if (focus) {
    parts.push("*Daily Focus*");
    parts.push(markdownToSlackMrkdwn(focus.body));
    parts.push("");
  }

  // Cross-functional synergies
  const synergies = content.sections.find(
    (s) => s.name === "cross-functional-synergies"
  );
  if (synergies) {
    parts.push("*Cross-Functional Synergies*");
    parts.push(markdownToSlackMrkdwn(synergies.body));
    parts.push("");
  }

  // Action items
  if (content.actionItems.length > 0) {
    parts.push("*Action Items*");
    for (const item of content.actionItems) {
      const priorityEmoji =
        item.priority === "critical"
          ? ":rotating_light:"
          : item.priority === "high"
            ? ":exclamation:"
            : item.priority === "medium"
              ? ":small_blue_diamond:"
              : ":small_orange_diamond:";
      const assignee = item.assignee ? ` _(${item.assignee})_` : "";
      parts.push(`${priorityEmoji} ${item.description}${assignee}`);
    }
    parts.push("");
  }

  parts.push(`_Report ID: ${reportId}_`);

  // Full meeting transcript for thread
  const transcript = content.sections.find(
    (s) => s.name === "meeting-transcript"
  );

  return {
    summary: parts.join("\n"),
    transcript: transcript
      ? `:memo: *Full Meeting Transcript*\n\n${markdownToSlackMrkdwn(transcript.body)}`
      : null,
  };
}

/**
 * Format a daily agent report as an array of Slack messages.
 * Each message becomes a separate post in a thread:
 *   1. Headline with health signal (parent message)
 *   2–N. One message per report section
 *   Last. Action items summary
 */
export function formatReportForSlack(
  agentName: string,
  content: ReportContent,
  reportId: string
): string[] {
  const messages: string[] = [];

  // Parent message: health + agent name + headline
  const healthEmoji =
    content.healthSignal === "green"
      ? ":large_green_circle:"
      : content.healthSignal === "yellow"
        ? ":large_yellow_circle:"
        : ":red_circle:";
  messages.push(
    `${healthEmoji} *${agentName} — Daily Report*\n> ${content.headline}\n\n_${content.sections.length} sections below in thread_`
  );

  // One message per section
  for (const section of content.sections) {
    const severityPrefix =
      section.severity === "critical"
        ? ":red_circle: "
        : section.severity === "warning"
          ? ":warning: "
          : "";
    // Title-case the section name for readability
    const title = section.name
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const body = markdownToSlackMrkdwn(section.body);
    messages.push(`${severityPrefix}*${title}*\n${body}`);
  }

  // Final message: action items
  if (content.actionItems.length > 0) {
    const lines = ["*Action Items*"];
    for (const item of content.actionItems) {
      const emoji =
        item.priority === "critical"
          ? ":rotating_light:"
          : item.priority === "high"
            ? ":exclamation:"
            : item.priority === "medium"
              ? ":small_blue_diamond:"
              : ":small_orange_diamond:";
      const assignee = item.assignee ? ` _(${item.assignee})_` : "";
      lines.push(`${emoji} ${item.description}${assignee}`);
    }
    messages.push(lines.join("\n"));
  }

  return messages;
}

/**
 * Post a full agent report to a Slack channel as a threaded conversation.
 * The first message is the headline (parent); sections + action items follow as replies.
 */
export async function postReportToSlack(
  token: string,
  channelId: string,
  agentName: string,
  content: ReportContent,
  reportId: string
): Promise<void> {
  const messages = formatReportForSlack(agentName, content, reportId);
  if (messages.length === 0) return;

  // Post headline as parent message
  const first = await postToSlack(token, channelId, messages[0]);
  if (!first.ok || !first.ts) {
    console.error(`Failed to post report headline to Slack: ${first.error}`);
    return;
  }

  // Post remaining messages as thread replies
  for (const msg of messages.slice(1)) {
    await postToSlack(token, channelId, msg, first.ts);
  }
}
