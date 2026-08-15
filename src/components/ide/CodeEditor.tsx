import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { highlight } from "@/lib/pawn/lexer";
import type { Diagnostic } from "@/lib/pawn/compiler";

interface CodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  diagnostics: Diagnostic[];
  onCursorChange?: (line: number, col: number) => void;
  gotoLine?: { line: number; nonce: number } | null;
}

const LINE_HEIGHT = 20;

export function CodeEditor({ value, onChange, diagnostics, onCursorChange, gotoLine }: CodeEditorProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState(1);

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const html = useMemo(() => highlight(value), [value]);

  const marks = useMemo(() => {
    const map = new Map<number, "error" | "warning">();
    for (const d of diagnostics) {
      if (d.severity === "error") map.set(d.line, "error");
      else if (d.severity === "warning" && !map.has(d.line)) map.set(d.line, "warning");
    }
    return map;
  }, [diagnostics]);

  const syncScroll = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }, []);

  const updateCursor = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const upto = ta.value.slice(0, ta.selectionStart);
    const parts = upto.split("\n");
    const line = parts.length;
    const col = (parts[parts.length - 1] ?? "").length + 1;
    setActiveLine(line);
    onCursorChange?.(line, col);
  }, [onCursorChange]);

  useLayoutEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  useEffect(() => {
    if (!gotoLine) return;
    const ta = taRef.current;
    if (!ta) return;
    const lines = ta.value.split("\n");
    const target = Math.min(Math.max(gotoLine.line, 1), lines.length);
    let pos = 0;
    for (let i = 0; i < target - 1; i++) pos += lines[i]!.length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos + (lines[target - 1]?.length ?? 0));
    ta.scrollTop = Math.max(0, (target - 6) * LINE_HEIGHT);
    syncScroll();
    updateCursor();
  }, [gotoLine, syncScroll, updateCursor]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      insert(ta, "    ");
      onChange(ta.value);
      return;
    }
    if (e.key === "Enter") {
      const start = ta.selectionStart;
      const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
      const currentLine = ta.value.slice(lineStart, start);
      const indent = /^[ \t]*/.exec(currentLine)![0];
      const extra = /[{(]\s*$/.test(currentLine) ? "    " : "";
      e.preventDefault();
      insert(ta, "\n" + indent + extra);
      onChange(ta.value);
      return;
    }
    if (e.key === "{" || e.key === "(" || e.key === "[" || e.key === '"') {
      const close = e.key === "{" ? "}" : e.key === "(" ? ")" : e.key === "[" ? "]" : '"';
      if (ta.selectionStart === ta.selectionEnd) {
        e.preventDefault();
        const pos = ta.selectionStart;
        insert(ta, e.key + close);
        ta.setSelectionRange(pos + 1, pos + 1);
        onChange(ta.value);
      }
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-editor">
      {/* gutter */}
      <div
        ref={gutterRef}
        className="code-surface w-14 shrink-0 overflow-hidden bg-editor pt-3 text-right select-none"
        aria-hidden
      >
        {Array.from({ length: lineCount }, (_, i) => {
          const n = i + 1;
          const mark = marks.get(n);
          return (
            <div
              key={n}
              className={
                "relative pr-3 " +
                (n === activeLine ? "text-foreground" : "text-editor-gutter")
              }
              style={{ height: LINE_HEIGHT }}
            >
              {mark && (
                <span
                  className={
                    "absolute left-1 top-1/2 -translate-y-1/2 text-[11px] " +
                    (mark === "error" ? "text-destructive" : "text-warning")
                  }
                >
                  ●
                </span>
              )}
              {n}
            </div>
          );
        })}
      </div>

      {/* code area */}
      <div className="relative min-w-0 flex-1">
        <pre
          ref={preRef}
          className="code-surface pointer-events-none absolute inset-0 overflow-hidden px-4 pt-3 whitespace-pre text-foreground"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyUp={updateCursor}
          onClick={updateCursor}
          onSelect={updateCursor}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className="code-surface absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent px-4 pt-3 whitespace-pre text-transparent caret-foreground outline-none"
          aria-label="Editor de código Pawn"
        />
      </div>
    </div>
  );
}

function insert(ta: HTMLTextAreaElement, text: string) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  ta.setSelectionRange(start + text.length, start + text.length);
}
