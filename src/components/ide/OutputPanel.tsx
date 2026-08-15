import type { CompileResult, Diagnostic } from "@/lib/pawn/compiler";

type Tab = "output" | "problems" | "symbols";

interface OutputPanelProps {
  result: CompileResult | null;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onGoto: (line: number) => void;
  height: number;
}

const sevColor: Record<string, string> = {
  error: "text-destructive",
  warning: "text-warning",
  info: "text-muted-foreground",
  success: "text-success",
};

export function OutputPanel({ result, tab, onTabChange, onGoto, height }: OutputPanelProps) {
  const errors = result?.diagnostics.filter((d) => d.severity === "error") ?? [];
  const warnings = result?.diagnostics.filter((d) => d.severity === "warning") ?? [];

  return (
    <section className="flex flex-col border-t border-border bg-panel" style={{ height }}>
      <div className="flex items-center gap-1 border-b border-border px-2 text-[11px] tracking-wide uppercase">
        {(
          [
            ["output", "Saída"],
            ["problems", `Problemas${result ? ` (${errors.length + warnings.length})` : ""}`],
            ["symbols", "Símbolos"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={
              "border-b-2 px-3 py-2 transition-colors " +
              (tab === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 pr-2 text-[11px] normal-case">
          <span className="text-destructive">✖ {errors.length}</span>
          <span className="text-warning">⚠ {warnings.length}</span>
        </div>
      </div>

      <div className="code-surface min-h-0 flex-1 overflow-auto px-3 py-2">
        {!result && (
          <p className="text-muted-foreground">
            Pressione <span className="text-foreground">F5</span> ou clique em{" "}
            <span className="text-foreground">Compilar</span> para gerar o .amx.
          </p>
        )}

        {result && tab === "output" && (
          <div>
            {result.log.map((l, i) => (
              <div key={i} className={"whitespace-pre-wrap " + (sevColor[l.severity] ?? "")}>
                {l.text}
              </div>
            ))}
            {result.diagnostics.map((d, i) => (
              <DiagLine key={`d${i}`} d={d} onGoto={onGoto} />
            ))}
          </div>
        )}

        {result && tab === "problems" && (
          <div>
            {result.diagnostics.length === 0 ? (
              <p className="text-success">Nenhum problema detectado.</p>
            ) : (
              result.diagnostics.map((d, i) => <DiagLine key={i} d={d} onGoto={onGoto} />)
            )}
          </div>
        )}

        {result && tab === "symbols" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SymbolList title="Includes" items={result.stats.includes} />
            <SymbolList title="Publics" items={result.stats.publics} />
            <SymbolList title="Natives" items={result.stats.natives} />
            <SymbolList title="Globais" items={result.stats.globals} />
          </div>
        )}
      </div>
    </section>
  );
}

function DiagLine({ d, onGoto }: { d: Diagnostic; onGoto: (line: number) => void }) {
  return (
    <button onClick={() => onGoto(d.line)} className="block w-full text-left hover:bg-accent/60">
      <span className="text-info">linha {d.line}</span>
      <span className="text-muted-foreground">:{d.col}</span>{" "}
      <span className={sevColor[d.severity]}>{d.code}:</span>{" "}
      <span className="text-foreground">{d.message}</span>
    </button>
  );
}

function SymbolList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul>
          {items.map((it) => (
            <li key={it} className="truncate">
              <span className="tk-function">{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
