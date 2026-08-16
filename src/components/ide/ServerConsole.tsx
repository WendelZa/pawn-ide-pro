import { useCallback, useEffect, useRef, useState } from "react";
import type { CompileResult } from "@/lib/pawn/compiler";

interface ServerConsoleProps {
  result: CompileResult | null;
  fileName: string;
}

interface Line {
  id: number;
  text: string;
  kind: "info" | "ok" | "warn" | "err" | "cmd";
}

let uid = 0;

export function ServerConsole({ result, fileName }: ServerConsoleProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const [cmd, setCmd] = useState("");
  const [players, setPlayers] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  const push = useCallback((text: string, kind: Line["kind"] = "info") => {
    setLines((prev) => [...prev.slice(-400), { id: ++uid, text, kind }]);
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(() => {
    if (running) return;
    if (!result?.ok || !result.amx) {
      push("[erro] Nenhum .amx compilado. Compile o script antes de iniciar o servidor.", "err");
      return;
    }
    setRunning(true);
    setPlayers(0);
    const amx = fileName.replace(/\.pwn$/i, ".amx");
    const seq: [number, string, Line["kind"]][] = [
      [0, "----------", "info"],
      [80, "SA-MP Dedicated Server", "info"],
      [140, "v0.3.7-R2, (C)2005-2015 SA-MP Team", "info"],
      [220, "----------", "info"],
      [320, "Server Plugins", "info"],
      [380, " Loaded 0 plugins.", "info"],
      [480, "Filterscripts", "info"],
      [540, "  Loaded 0 filterscripts.", "info"],
      [660, `Loading gamemode: ${amx} (${result.amx.length} bytes)`, "info"],
      [760, `  Publics: ${result.stats.publics.length} · Natives: ${result.stats.natives.length} · Globais: ${result.stats.globals.length}`, "info"],
      [860, "  Script main() executado com sucesso.", "ok"],
      [960, "Number of vehicle models: 0", "info"],
      [1060, "Started server on port: 7777, with maxplayers: 50 lanmode is OFF.", "ok"],
      [1160, "Ready. Digite comandos RCON abaixo (ex: players, gmx, exit).", "ok"],
    ];
    for (const [ms, text, kind] of seq) {
      timers.current.push(setTimeout(() => push(text, kind), ms));
    }
    for (const w of result.diagnostics.filter((d) => d.severity === "warning").slice(0, 5)) {
      timers.current.push(setTimeout(() => push(`[aviso] linha ${w.line}: ${w.message}`, "warn"), 1300));
    }
  }, [running, result, fileName, push]);

  const stop = useCallback(() => {
    if (!running) return;
    clearTimers();
    setRunning(false);
    setPlayers(0);
    push("Servidor encerrado. --- Unloading gamemode ---", "warn");
  }, [running, clearTimers, push]);

  const runCmd = useCallback(
    (raw: string) => {
      const c = raw.trim();
      if (!c) return;
      push(`> ${c}`, "cmd");
      setCmd("");
      if (!running) {
        push("[erro] O servidor não está rodando.", "err");
        return;
      }
      const [name, ...args] = c.split(/\s+/);
      switch ((name ?? "").toLowerCase()) {
        case "players":
          push(`ID      Name              Ping    IP`, "info");
          if (players === 0) push("(nenhum jogador conectado)", "info");
          else
            for (let i = 0; i < players; i++)
              push(`${i}\tJogador_${i}\t\t${30 + i * 7}\t127.0.0.${10 + i}`, "info");
          break;
        case "conectar":
        case "join": {
          const id = players;
          setPlayers(players + 1);
          push(`[connection] 127.0.0.${10 + id}:7777 requests connection cookie.`, "info");
          push(`[join] Jogador_${id} has joined the server (${id}:127.0.0.${10 + id})`, "ok");
          break;
        }
        case "say":
          push(`[chat] Servidor: ${args.join(" ")}`, "ok");
          break;
        case "gmx":
          push("Reiniciando gamemode…", "warn");
          setPlayers(0);
          push(`Loading gamemode: ${fileName.replace(/\.pwn$/i, ".amx")}`, "info");
          push("  Script main() executado com sucesso.", "ok");
          break;
        case "exit":
          stop();
          break;
        case "hostname":
          push(`hostname alterado para "${args.join(" ") || "SA-MP Server"}"`, "ok");
          break;
        case "help":
          push("Comandos: players, conectar, say [msg], gmx, hostname [nome], exit", "info");
          break;
        default:
          push(`Invalid RCON command: ${name}`, "err");
      }
    },
    [running, players, push, fileName, stop],
  );

  const color: Record<Line["kind"], string> = {
    info: "text-foreground/85",
    ok: "text-success",
    warn: "text-warning",
    err: "text-destructive",
    cmd: "text-info",
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <button
          onClick={start}
          disabled={running}
          className="rounded bg-success/20 px-3 py-1 text-[12px] font-semibold text-success transition-colors hover:bg-success/30 disabled:opacity-40"
        >
          ▶ Iniciar servidor
        </button>
        <button
          onClick={stop}
          disabled={!running}
          className="rounded bg-destructive/20 px-3 py-1 text-[12px] font-semibold text-destructive transition-colors hover:bg-destructive/30 disabled:opacity-40"
        >
          ■ Parar
        </button>
        <button
          onClick={() => setLines([])}
          className="rounded border border-border px-3 py-1 text-[12px] text-muted-foreground hover:bg-accent"
        >
          Limpar log
        </button>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className={
              "inline-block h-2 w-2 rounded-full " + (running ? "animate-pulse bg-success" : "bg-muted-foreground")
            }
          />
          {running ? `online · ${players} jogador(es) · porta 7777` : "offline"}
        </span>
      </div>

      <div ref={scroller} className="code-surface min-h-0 flex-1 overflow-auto bg-editor px-3 py-2">
        {lines.length === 0 && (
          <p className="text-muted-foreground">
            Console do servidor simulado. Compile o script e clique em{" "}
            <span className="text-success">Iniciar servidor</span>. Comandos: help, players,
            conectar, say, gmx, exit.
          </p>
        )}
        {lines.map((l) => (
          <div key={l.id} className={"whitespace-pre-wrap " + color[l.kind]}>
            {l.text}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runCmd(cmd);
        }}
        className="flex shrink-0 items-center gap-2 border-t border-border px-2 py-2"
      >
        <span className="text-[12px] text-muted-foreground">RCON</span>
        <input
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="players"
          className="code-surface flex-1 rounded border border-border bg-input px-2 py-1 outline-none focus:border-primary"
        />
        <button className="rounded bg-primary px-3 py-1 text-[12px] font-semibold text-primary-foreground hover:opacity-90">
          Executar
        </button>
      </form>
    </div>
  );
}
