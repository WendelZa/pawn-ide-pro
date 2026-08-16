import { useCallback, useRef, useState } from "react";
import { convertMtaToPawn, type ConversionResult, type MtaInputFile } from "@/lib/pawn/mta";

interface MtaConverterProps {
  onCreateFile: (name: string, content: string) => void;
  onDownload: (data: BlobPart, name: string, type: string) => void;
}

export function MtaConverter({ onCreateFile, onDownload }: MtaConverterProps) {
  const [files, setFiles] = useState<MtaInputFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<string>("");
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const readFiles = useCallback(async (list: FileList | null) => {
    if (!list?.length) return;
    const wanted = Array.from(list).filter((f) => /\.(lua|xml|meta|conf|txt)$/i.test(f.name));
    const target = wanted.length ? wanted : Array.from(list);
    const read: MtaInputFile[] = [];
    for (const f of target) {
      read.push({ name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, content: await f.text() });
    }
    setFiles(read);
    setResult(null);
    setProgress(0);
    setPhase(`${read.length} arquivo(s) carregado(s)`);
  }, []);

  const convert = useCallback(async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setResult(null);
    const steps = [
      "Lendo arquivos do servidor MTA…",
      "Detectando comandos (addCommandHandler)…",
      "Mapeando eventos para callbacks SA-MP…",
      "Convertendo funções e variáveis…",
      "Montando arquivo .pwn final…",
    ];
    for (let i = 0; i < steps.length; i++) {
      setPhase(steps[i]!);
      setProgress(Math.round(((i + 1) / (steps.length + 1)) * 100));
      await new Promise((r) => setTimeout(r, 220));
    }
    const res = convertMtaToPawn(files);
    setResult(res);
    setProgress(100);
    setPhase("Conversão concluída");
    setBusy(false);
  }, [files, busy]);

  return (
    <div className="min-h-0 flex-1 overflow-auto px-3 py-3 text-[12.5px]">
      <p className="mb-3 text-muted-foreground">
        🔄 <span className="text-foreground">Conversor MTA → SA-MP</span>: importe a pasta inteira do
        servidor MTA ou apenas arquivos <span className="text-foreground">.lua</span>. Toda a lógica,
        nomes e valores originais são preservados.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => folderInput.current?.click()}
          className="rounded bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:opacity-90"
        >
          📁 Selecionar pasta do servidor
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="rounded border border-border bg-secondary px-3 py-1.5 text-secondary-foreground hover:bg-accent"
        >
          📄 Selecionar arquivos .lua
        </button>
        <button
          onClick={() => void convert()}
          disabled={!files.length || busy}
          className="rounded bg-success/20 px-3 py-1.5 font-semibold text-success hover:bg-success/30 disabled:opacity-40"
        >
          ⚙ Converter agora
        </button>
        {result && (
          <>
            <button
              onClick={() => onCreateFile("convertido_mta.pwn", result.pwn)}
              className="rounded border border-border px-3 py-1.5 text-warning hover:bg-accent"
            >
              Abrir no editor
            </button>
            <button
              onClick={() => onDownload(result.pwn, "convertido_mta.pwn", "text/plain;charset=utf-8")}
              className="rounded border border-border px-3 py-1.5 hover:bg-accent"
            >
              ⬇ Baixar .pwn
            </button>
            <button
              onClick={() =>
                onDownload(buildReport(result), "relatorio_conversao.txt", "text/plain;charset=utf-8")
              }
              className="rounded border border-border px-3 py-1.5 text-muted-foreground hover:bg-accent"
            >
              ⬇ Baixar relatório
            </button>
          </>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".lua,.xml,.meta,.txt"
        className="hidden"
        onChange={(e) => void readFiles(e.target.files)}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        // @ts-expect-error atributos de seleção de diretório
        webkitdirectory="true"
        directory="true"
        className="hidden"
        onChange={(e) => void readFiles(e.target.files)}
      />

      {(phase || progress > 0) && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-input">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-info to-success transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {phase} {progress > 0 && `— ${progress}%`}
          </p>
        </div>
      )}

      {files.length > 0 && !result && (
        <ul className="mt-3 max-h-40 overflow-auto rounded border border-border bg-card/60 p-2">
          {files.map((f) => (
            <li key={f.name} className="truncate text-muted-foreground">
              <span className="text-info">lua</span> {f.name} ({f.content.split("\n").length} linhas)
            </li>
          ))}
        </ul>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label="Arquivos lidos" value={String(result.summary.files)} />
            <Stat label="Linhas Lua" value={String(result.summary.luaLines)} />
            <Stat label="Linhas Pawn" value={String(result.summary.pwnLines)} />
            <Stat label="Alterações" value={String(result.changes.length)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <List title={`Comandos (${result.summary.commands.length})`} items={result.summary.commands} />
            <List title={`Eventos (${result.summary.events.length})`} items={result.summary.events} />
            <List title={`Funções (${result.summary.functions.length})`} items={result.summary.functions} />
          </div>

          {result.summary.warnings.length > 0 && (
            <div>
              <h3 className="mb-1 text-[11px] tracking-wide text-warning uppercase">Avisos</h3>
              <ul className="space-y-0.5">
                {result.summary.warnings.map((w, i) => (
                  <li key={i} className="text-warning">
                    ⚠ {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
              Relatório de alterações
            </h3>
            <div className="max-h-56 overflow-auto rounded border border-border bg-card/60">
              {result.changes.map((c, i) => (
                <div key={i} className="border-b border-border/60 px-2 py-1 last:border-0">
                  <span className="text-info">{c.file}</span>
                  {c.line ? <span className="text-muted-foreground">:{c.line}</span> : null}{" "}
                  <span className="text-warning">{c.rule}</span>
                  <div className="code-surface truncate text-muted-foreground">- {c.from}</div>
                  <div className="code-surface truncate text-success">+ {c.to}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
              Prévia do .pwn gerado
            </h3>
            <pre className="code-surface max-h-72 overflow-auto rounded border border-border bg-editor px-3 py-2 whitespace-pre">
              {result.pwn}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-card/60 px-3 py-2">
      <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
      <div className="text-[15px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-[11px] tracking-wide text-muted-foreground uppercase">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="max-h-40 space-y-0.5 overflow-auto">
          {items.map((it, i) => (
            <li key={i} className="truncate text-foreground/90">
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildReport(r: ConversionResult): string {
  const l: string[] = [];
  l.push("RELATÓRIO DE CONVERSÃO MTA:SA → SA-MP");
  l.push("Gerado por PAWN MASTER PRO");
  l.push("");
  l.push(`Arquivos lidos: ${r.summary.files}`);
  l.push(`Linhas Lua: ${r.summary.luaLines} | Linhas Pawn: ${r.summary.pwnLines}`);
  l.push(`Total de alterações: ${r.changes.length}`);
  l.push("");
  l.push("COMANDOS:");
  r.summary.commands.forEach((c) => l.push("  " + c));
  l.push("EVENTOS:");
  r.summary.events.forEach((c) => l.push("  " + c));
  l.push("FUNÇÕES:");
  r.summary.functions.forEach((c) => l.push("  " + c));
  l.push("AVISOS:");
  r.summary.warnings.forEach((c) => l.push("  " + c));
  l.push("");
  l.push("ALTERAÇÕES DETALHADAS:");
  r.changes.forEach((c) => l.push(`  [${c.rule}] ${c.file}:${c.line}\n    - ${c.from}\n    + ${c.to}`));
  return l.join("\n");
}
