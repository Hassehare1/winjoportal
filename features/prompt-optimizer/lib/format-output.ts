export function formatPromptOutput(raw: string): string {
  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");

  // Keep headings visually separated.
  text = text.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");

  // Keep numbered lists separated from preceding paragraphs.
  text = text.replace(/([^\n])\n(\d+\.\s)/g, "$1\n\n$2");

  // Avoid excessive blank lines.
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}
