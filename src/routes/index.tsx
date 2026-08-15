import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { OutputPanel } from "@/components/ide/OutputPanel";
import { compilePawn, type CompileResult } from "@/lib/pawn/compiler";
import { SAMPLE_PWN } from "@/lib/pawn/sample";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAWN IDE — Editor e Compilador .pwn para .amx (SA-MP)" },
      {
        name: "description",
        content:
          "IDE profissional para a linguagem Pawn: editor com destaque de sintaxe, compilador integrado com log detalhado e geração de arquivo .amx direto no navegador.",
      },
      { property: "og:title", content: "PAWN IDE — Editor e Compilador .pwn para .amx" },
      {
        property: "og:description",
        content:
          "Escreva, valide e compile scripts Pawn (.pwn) de SA-MP no navegador e baixe o binário .amx gerado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PawnIde,
});

interface PawnFile {
  name: string;
  content: string;
}

const STORAGE_KEY = "pawn-ide-workspace-v1";

function PawnIde() {
  const [files, setFiles] = useState<PawnFile[]>([{ name: "gamemode.pwn", content: SAMPLE_PWN }]);
  const [active, setActive] = useState(0);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [tab, setTab] = useState<"output" | "problems" | "symbols">("output");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [goto, setGoto] = useState<{ line: number; nonce: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const current = files[active] ?? files[0]!;

  // restore workspace
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { files: PawnFile[]; active: number };
      if (Array.isArray(parsed.files) && parsed.files.length) {
        setFiles(parsed.files);
        setActive(Math.min(parsed.active ?? 0, parsed.files.length - 1));
      }
    } catch {
      /* ignore corrupted state */
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

  const compile = useCallback(() => {
    setBusy(true);
    // deixa o browser pintar o estado "compilando" antes do trabalho síncrono
    setTimeout(() => {
      const res = compilePawn(current.content, current.name);
      setResult(res);
      setTab(res.diagnostics.length && !res.ok ? "problems" : "output");
      setBusy(false);
      setToast(res.ok ? `Compilado: ${current.name.replace(/\.pwn$/i, ".amx")} pronto` : "Compilação falhou");
    }, 20);
  }, [current]);

  const newFile = useCallback(() => {
    const base = `novo_script${files.length ? files.length : ""}.pwn`;
    const template = `#include <a_samp>\n\nmain()\n{\n    print("Ola, Pawn!");\n}\n\npublic OnGameModeInit()\n{\n    SetGameModeText("Novo Modo");\n    return 1;\n}\n`;
    setFiles((prev) => [...prev, { name: base, content: template }]);
    setActive(files.length);
    setResult(null);
  }, [files.length]);

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
    const bytes = new Uint8Array(result.amx);
    download(bytes, current.name.replace(/\.pwn$/i, "") + ".amx", "application/octet-stream");
    setToast("Binário .amx baixado");
  }, [result, current.name, download]);

  const closeFile = useCallback(
    (idx: number) => {
      setFiles((prev) => {
        if (prev.length === 1) return prev;
        const next = prev.filter((_, i) => i !== idx);
        setActive((a) => (a >= next.length ? next.length - 1 : a > idx ? a - 1 : a));
        return next;
      });
    },
    [],
  );

  // atalhos de teclado
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <h1 className="sr-only">PAWN IDE — editor e compilador de scripts .pwn para .amx</h1>

      {/* title bar */}
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-titlebar px-3">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="grid h-5 w-5 place-items-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
            P
          </span>
          PAWN IDE
        </span>
        <nav className="flex items-center gap-0.5 text-[12px] text-muted-foreground">
          <MenuBtn onClick={newFile}>Novo</MenuBtn>
          <MenuBtn onClick={() => fileInput.current?.click()}>Abrir .pwn</MenuBtn>
          <MenuBtn onClick={savePwn}>Salvar .pwn</MenuBtn>
          <MenuBtn onClick={() => setSidebarOpen((v) => !v)}>Explorador</MenuBtn>
        </nav>
        <span className="ml-auto truncate text-[12px] text-muted-foreground">
          {current.name}
          {dirty ? " •" : ""} — Pawn 3.2 / AMX v8
        </span>
      </header>

      {/* toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <button
          onClick={compile}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          ▶ {busy ? "Compilando..." : "Compilar (F5)"}
        </button>
        <button
          onClick={downloadAmx}
          disabled={!result?.amx}
          className="inline-flex items-center gap-2 rounded border border-border bg-secondary px-3 py-1.5 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          ⬇ Baixar .amx
        </button>
        <div className="ml-auto flex items-center gap-4 text-[11px] text-muted-foreground">
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
        {/* explorer */}
        {sidebarOpen && (
          <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
            <div className="px-3 py-2 text-[11px] tracking-wide text-muted-foreground uppercase">
              Explorador
            </div>
            <ul className="min-h-0 flex-1 overflow-auto text-[12.5px]">
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
            <div className="border-t border-sidebar-border p-3 text-[11px] leading-relaxed text-muted-foreground">
              Atalhos: <br />
              F5 compilar · Ctrl+S salvar <br />
              Ctrl+O abrir · Ctrl+N novo
            </div>
          </aside>
        )}

        {/* editor + panel */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-titlebar">
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

          <OutputPanel
            result={result}
            tab={tab}
            onTabChange={setTab}
            onGoto={(line) => setGoto({ line, nonce: Date.now() })}
            height={216}
          />
        </main>
      </div>

      {/* status bar */}
      <footer className="flex h-6 shrink-0 items-center gap-4 bg-statusbar px-3 text-[11px] text-statusbar-foreground">
        <span>{errorCount === 0 && result ? "✔ Build OK" : result ? `✖ ${errorCount} erro(s)` : "Pronto"}</span>
        <span>
          Ln {cursor.line}, Col {cursor.col}
        </span>
        <span className="ml-auto">UTF-8</span>
        <span>Espaços: 4</span>
        <span>Pawn</span>
      </footer>

      {toast && (
        <div className="pointer-events-none fixed bottom-9 left-1/2 -translate-x-1/2 rounded border border-border bg-popover px-4 py-2 text-[12.5px] text-popover-foreground shadow-lg">
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
