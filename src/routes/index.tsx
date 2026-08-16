import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { OutputPanel } from "@/components/ide/OutputPanel";
import { FunctionLibrary } from "@/components/ide/FunctionLibrary";
import { ServerConsole } from "@/components/ide/ServerConsole";
import { AiAssistant } from "@/components/ide/AiAssistant";
import { MtaConverter } from "@/components/ide/MtaConverter";
import { compilePawn, type CompileResult } from "@/lib/pawn/compiler";
import { SAMPLE_PWN } from "@/lib/pawn/sample";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAWN Master Pro — IDE, Compilador .amx, IA e Conversor MTA" },
      {
        name: "description",
        content:
          "IDE completa para PAWN/SA-MP: editor com destaque de sintaxe, compilador .pwn → .amx, servidor simulado, IA assistente especializada e conversor MTA → SA-MP.",
      },
      { property: "og:title", content: "PAWN Master Pro — IDE completa para SA-MP" },
      {
        property: "og:description",
        content:
          "Compile .pwn para .amx, teste no servidor simulado, peça código à IA especializada em PAWN e converta servidores MTA (Lua) para SA-MP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PawnMasterPro,
});

interface PawnFile {
  name: string;
  content: string;
}

type PanelTab = "compilador" | "servidor" | "ia" | "mta";

const STORAGE_KEY = "pawn-ide-workspace-v1";

let workspaceRestored = false;

function PawnMasterPro() {
  const [files, setFiles] = useState<PawnFile[]>([{ name: "gamemode.pwn", content: SAMPLE_PWN }]);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [outTab, setOutTab] = useState<"output" | "problems" | "symbols">("output");
  const [panel, setPanel] = useState<PanelTab>("compilador");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [goto, setGoto] = useState<{ line: number; nonce: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const current = files[active] ?? files[0]!;

  useEffect(() => {
    if (workspaceRestored) return;
    workspaceRestored = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { files: PawnFile[]; active: number };
      if (Array.isArray(parsed.files) && parsed.files.length) {
        setFiles(parsed.files);
        setActive(Math.min(parsed.active ?? 0, parsed.files.length - 1));
      }
    } catch {
      /* estado corrompido */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, active }));
    } catch {
      /* quota */
    }
  }, [files, active]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const setContent = useCallback(
    (next: string) => {
      setFiles((prev) => prev.map((f, i) => (i === active ? { ...f, content: next } : f)));
      setDirty(true);
    },
    [active],
  );

  const insertCode = useCallback(
    (code: string) => {
      setContent((current.content.replace(/\s*$/, "") + "\n\n" + code.trim() + "\n").trimStart());
      setToast("Código inserido no editor");
    },
    [current.content, setContent],
  );

  const replaceCode = useCallback(
    (code: string) => {
      setContent(code);
      setToast("Código do editor substituído");
    },
    [setContent],
  );

  const compile = useCallback(() => {
    setBusy(true);
    setPanel("compilador");
    setTimeout(() => {
      const res = compilePawn(current.content, current.name);
      setResult(res);
      setOutTab(res.diagnostics.length && !res.ok ? "problems" : "output");
      setBusy(false);
      setToast(
        res.ok ? `Compilado: ${current.name.replace(/\.pwn$/i, ".amx")} pronto` : "Compilação falhou",
      );
    }, 20);
  }, [current]);

  const newFile = useCallback(
    (name?: string, content?: string) => {
      const base = name ?? `novo_script${files.length ? files.length : ""}.pwn`;
      const template =
        content ??
        `#include <a_samp>\n\nmain()\n{\n    print("Ola, Pawn!");\n}\n\npublic OnGameModeInit()\n{\n    SetGameModeText("Novo Modo");\n    return 1;\n}\n`;
      setFiles((prev) => [...prev, { name: base, content: template }]);
      setActive(files.length);
      setResult(null);
      setToast(`${base} criado`);
    },
    [files.length],
  );

  const openFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setFiles((prev) => {
        const next = [...prev, { name: file.name, content }];
        setActive(next.length - 1);
        return next;
      });
      setResult(null);
      setToast(`${file.name} aberto`);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const download = useCallback((data: BlobPart, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const savePwn = useCallback(() => {
    download(current.content, current.name, "text/plain;charset=utf-8");
    setDirty(false);
    setToast(`${current.name} salvo`);
  }, [current, download]);

  const downloadAmx = useCallback(() => {
    if (!result?.amx) return;
    download(new Uint8Array(result.amx), current.name.replace(/\.pwn$/i, "") + ".amx", "application/octet-stream");
    setToast("Binário .amx baixado");
  }, [result, current.name, download]);

  const closeFile = useCallback((idx: number) => {
    setFiles((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      setActive((a) => (a >= next.length ? next.length - 1 : a > idx ? a - 1 : a));
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        compile();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        savePwn();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInput.current?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newFile();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compile, savePwn, newFile]);

  const stats = useMemo(() => result?.stats ?? null, [result]);
  const errorCount = result?.diagnostics.filter((d) => d.severity === "error").length ?? 0;

  const TABS: [PanelTab, string][] = [
    ["compilador", "⚙ COMPILADOR"],
    ["servidor", "🖧 SERVIDOR SIMULADO"],
    ["ia", "🧠 IA ASSISTENTE"],
    ["mta", "🔄 MTA → SA-MP"],
  ];

  return (
    <div className="app-aurora flex h-screen w-screen flex-col overflow-hidden">
      <h1 className="sr-only">
        PAWN Master Pro — IDE, compilador .pwn para .amx, IA assistente e conversor MTA para SA-MP
      </h1>

      {/* barra superior */}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-titlebar/80 px-3 backdrop-blur">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold">
          <span className="glow-primary grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary via-info to-success text-[12px] font-bold text-primary-foreground">
            P
          </span>
          PAWN <span className="bg-gradient-to-r from-info to-success bg-clip-text text-transparent">MASTER PRO</span>
        </span>
        <nav className="hidden items-center gap-0.5 text-[12px] text-muted-foreground sm:flex">
          <MenuBtn onClick={() => newFile()}>Novo</MenuBtn>
          <MenuBtn onClick={() => fileInput.current?.click()}>Abrir .pwn</MenuBtn>
          <MenuBtn onClick={savePwn}>Salvar .pwn</MenuBtn>
          <MenuBtn onClick={() => setSidebarOpen((v) => !v)}>Biblioteca</MenuBtn>
        </nav>
        <span className="ml-auto flex items-center gap-3 text-[11.5px] text-muted-foreground">
          <span className="hidden truncate md:inline">
            {current.name}
            {dirty ? " •" : ""}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5">
            <span
              className={
                "inline-block h-2 w-2 rounded-full " +
                (result ? (errorCount ? "bg-destructive" : "bg-success") : "bg-warning")
              }
            />
            {result ? (errorCount ? `${errorCount} erro(s)` : "build OK") : "pronto"}
          </span>
        </span>
      </header>

      {/* toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card/70 px-3 backdrop-blur">
        <button
          onClick={compile}
          disabled={busy}
          className="glow-primary inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-primary to-info px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
        >
          ▶ {busy ? "Compilando..." : "Compilar (F5)"}
        </button>
        <button
          onClick={downloadAmx}
          disabled={!result?.amx}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          ⬇ Baixar .amx
        </button>
        <button
          onClick={savePwn}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          💾 Salvar .pwn
        </button>
        <div className="ml-auto hidden items-center gap-4 text-[11px] text-muted-foreground md:flex">
          {stats && (
            <>
              <span>{stats.lines} linhas</span>
              <span>{stats.tokens} tokens</span>
              <span>{stats.durationMs} ms</span>
              {result?.amx && <span className="text-success">{result.amx.length} bytes .amx</span>}
            </>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".pwn,.inc,.p,.pawn,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* biblioteca lateral */}
        {sidebarOpen && (
          <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur lg:flex">
            <div className="px-3 py-2 text-[11px] tracking-wide text-muted-foreground uppercase">
              📚 Biblioteca de funções
            </div>
            <FunctionLibrary onInsert={insertCode} onReplaceAll={replaceCode} />
            <div className="border-t border-sidebar-border px-3 py-2 text-[11px] tracking-wide text-muted-foreground uppercase">
              Arquivos
            </div>
            <ul className="max-h-40 overflow-auto text-[12.5px]">
              {files.map((f, i) => (
                <li key={f.name + i}>
                  <div
                    className={
                      "group flex items-center gap-2 px-3 py-1.5 " +
                      (i === active
                        ? "bg-accent text-accent-foreground"
                        : "text-sidebar-foreground hover:bg-accent/50")
                    }
                  >
                    <button className="flex-1 truncate text-left" onClick={() => setActive(i)}>
                      <span className="mr-1 text-warning">◆</span>
                      {f.name}
                    </button>
                    {files.length > 1 && (
                      <button
                        onClick={() => closeFile(i)}
                        aria-label={`Fechar ${f.name}`}
                        className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* editor + painéis */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-titlebar/70">
            {files.map((f, i) => (
              <button
                key={f.name + i}
                onClick={() => setActive(i)}
                className={
                  "flex items-center gap-2 border-r border-border px-3 text-[12.5px] whitespace-nowrap " +
                  (i === active
                    ? "border-t-2 border-t-primary bg-editor text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {f.name}
              </button>
            ))}
          </div>

          <CodeEditor
            value={current.content}
            onChange={setContent}
            diagnostics={result?.diagnostics ?? []}
            onCursorChange={(line, col) => setCursor({ line, col })}
            gotoLine={goto}
          />

          {/* abas dos painéis */}
          <section className="flex h-[300px] shrink-0 flex-col border-t border-border bg-panel/85 backdrop-blur">
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 text-[11px] tracking-wide uppercase">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPanel(key)}
                  className={
                    "border-b-2 px-3 py-2 whitespace-nowrap transition-colors " +
                    (panel === key
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground")
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {panel === "compilador" && (
              <OutputPanel
                result={result}
                tab={outTab}
                onTabChange={setOutTab}
                onGoto={(line) => setGoto({ line, nonce: Date.now() })}
                height={258}
              />
            )}
            {panel === "servidor" && <ServerConsole result={result} fileName={current.name} />}
            {panel === "ia" && (
              <AiAssistant code={current.content} onInsertCode={insertCode} onReplaceCode={replaceCode} />
            )}
            {panel === "mta" && (
              <MtaConverter
                onCreateFile={(name, content) => {
                  newFile(name, content);
                  setPanel("compilador");
                }}
                onDownload={download}
              />
            )}
          </section>
        </main>
      </div>

      {/* barra de status */}
      <footer className="flex h-6 shrink-0 items-center gap-4 bg-statusbar px-3 text-[11px] text-statusbar-foreground">
        <span>
          {errorCount === 0 && result ? "✔ Build OK" : result ? `✖ ${errorCount} erro(s)` : "Pronto"}
        </span>
        <span>
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <span className="ml-auto">UTF-8</span>
        <span>Espaços: 4</span>
        <span>Pawn</span>
      </footer>

      {toast && (
        <div className="pointer-events-none fixed bottom-9 left-1/2 -translate-x-1/2 rounded-md border border-border bg-popover px-4 py-2 text-[12.5px] text-popover-foreground shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function MenuBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-2 py-1 transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {children}
    </button>
  );
}
