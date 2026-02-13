"use client";

import { FormEvent, useMemo, useState } from "react";

type AnalyticsAiAssistantProps = {
  selectedMonth: string | null;
};

type AssistantApiResponse = {
  answer?: string;
  error?: string;
  selectedMonth?: string;
  source?: "openai" | "rules";
};

type AnswerBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

function splitMarkdownTableRow(line: string): string[] {
  const content = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return content.split("|").map((cell) => cell.trim());
}

function isMarkdownTableDivider(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function parseAnswerBlocks(input: string): AnswerBlock[] {
  const lines = input.replace(/\r/g, "").split("\n");
  const blocks: AnswerBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      let tableIndex = index;
      while (tableIndex < lines.length && (lines[tableIndex]?.trim() ?? "").startsWith("|")) {
        tableLines.push(lines[tableIndex].trim());
        tableIndex += 1;
      }

      if (tableLines.length >= 3) {
        const header = splitMarkdownTableRow(tableLines[0]);
        const divider = splitMarkdownTableRow(tableLines[1]);
        if (header.length > 0 && header.length === divider.length && isMarkdownTableDivider(divider)) {
          const rows = tableLines
            .slice(2)
            .map(splitMarkdownTableRow)
            .filter((row) => row.length === header.length);
          blocks.push({ type: "table", headers: header, rows });
          index = tableIndex;
          continue;
        }
      }
    }

    if (line.startsWith("#")) {
      blocks.push({ type: "heading", text: line.replace(/^#{1,3}\s+/, "") });
      index += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const listLine = lines[listIndex]?.trim() ?? "";
        if (!listLine.startsWith("- ")) {
          break;
        }
        items.push(listLine.slice(2).trim());
        listIndex += 1;
      }
      blocks.push({ type: "list", items });
      index = listIndex;
      continue;
    }

    const paragraphLines: string[] = [line];
    let paragraphIndex = index + 1;
    while (paragraphIndex < lines.length) {
      const nextLine = lines[paragraphIndex]?.trim() ?? "";
      if (!nextLine || nextLine.startsWith("|") || nextLine.startsWith("- ") || nextLine.startsWith("#")) {
        break;
      }
      paragraphLines.push(nextLine);
      paragraphIndex += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    index = paragraphIndex;
  }

  return blocks;
}

function isNumericCell(value: string): boolean {
  return /^-?[\d\s.,:%x]+$/.test(value.trim()) && /\d/.test(value);
}

export function AnalyticsAiAssistant({ selectedMonth }: AnalyticsAiAssistantProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [answeredMonth, setAnsweredMonth] = useState<string | null>(null);
  const [source, setSource] = useState<"openai" | "rules" | null>(null);

  const suggestions = useMemo(
    () => [
      "Vilken butik har högst lagertäckning i senaste perioden och varför?",
      "Sammanfatta topp 3 risker i datan just nu.",
      "Vilka avdelningar har lägst TB % och hur stor är nettoförsäljningen där?",
      "Finns negativ marginal i risklistan och vilka artiklar driver den?",
      "Vilken butik har högst lagerestimat relativt sin försäljning?",
      "Ge 3 konkreta åtgärder för att minska lagerdagar utan att skada TB."
    ],
    []
  );

  const answerBlocks = useMemo(() => parseAnswerBlocks(answer), [answer]);

  async function ask(inputQuestion: string) {
    const trimmed = inputQuestion.trim();
    if (trimmed.length < 3) {
      setError("Skriv en lite längre fråga.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: trimmed,
          month: selectedMonth || undefined
        })
      });

      const payload = (await response.json().catch(() => ({}))) as AssistantApiResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Kunde inte hämta svar.");
      }

      setAnswer(payload.answer || "Inget svar mottogs.");
      setAnsweredMonth(payload.selectedMonth || selectedMonth);
      setSource(payload.source || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Okänt fel.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(question);
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-card backdrop-blur">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">AI Assistent</p>
        <h2 className="font-heading text-xl font-bold text-slate-900">Frågor på din KPI-data</h2>
        <p className="text-xs text-slate-600">
          Snabb modell, strikt dataläge. Svarar endast utifrån KPI-underlaget för vald period.
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setQuestion(item);
              void ask(item);
            }}
            disabled={pending}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {item}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        <label htmlFor="analytics-ai-question" className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          Egen fråga
        </label>
        <textarea
          id="analytics-ai-question"
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex: Vilken avdelning bör jag agera på först denna månad?"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {pending ? "Analyserar..." : "Fråga assistenten"}
        </button>
      </form>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Svar</p>
          {answeredMonth ? (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Period: {answeredMonth}
            </span>
          ) : null}
          {source ? (
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Källa: {source === "openai" ? "OpenAI" : "Regelmotor"}
            </span>
          ) : null}
        </div>
        <div className="max-h-[420px] overflow-auto p-3">
          {answer ? (
            <div className="space-y-3">
              {answerBlocks.map((block, blockIndex) => {
                if (block.type === "heading") {
                  return (
                    <h3 key={`${block.type}-${blockIndex}`} className="text-sm font-semibold text-slate-900">
                      {block.text}
                    </h3>
                  );
                }

                if (block.type === "list") {
                  return (
                    <ul key={`${block.type}-${blockIndex}`} className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
                      {block.items.map((item, itemIndex) => (
                        <li key={`${item}-${itemIndex}`}>{item}</li>
                      ))}
                    </ul>
                  );
                }

                if (block.type === "table") {
                  return (
                    <div key={`${block.type}-${blockIndex}`} className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="w-full table-fixed text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            {block.headers.map((header) => (
                              <th
                                key={header}
                                className="break-words px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.06em] text-slate-500 [overflow-wrap:anywhere]"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, rowIndex) => (
                            <tr key={`${row.join("|")}-${rowIndex}`} className="border-t border-slate-100">
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${cell}-${cellIndex}`}
                                  className={`break-words px-2 py-2 align-top text-slate-700 [overflow-wrap:anywhere] ${isNumericCell(cell) ? "text-right tabular-nums" : "text-left"}`}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                return (
                  <p key={`${block.type}-${blockIndex}`} className="text-sm leading-6 text-slate-700">
                    {block.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-500">Inget svar än. Klicka på ett förslag eller skriv en egen fråga.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
