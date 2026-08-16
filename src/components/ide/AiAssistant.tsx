import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askPawnAi, type ChatTurn } from "@/lib/ai.functions";

interface AiAssistantProps {
  code: string;
  onInsertCode: (code: string) => void;
  onReplaceCode: (code: string) => void;
}

interface Msg extends ChatTurn {
  id: number;
}

const QUICK = [
  { label: "Consertar erros do meu código", prompt: "Analise o código do editor, encontre TODOS os erros de sintaxe e lógica, entregue o código corrigido completo e explique cada erro." },
  { label: "Criar sistema de registro/login", prompt: "Crie um sistema completo de registro e login por dialog usando apenas funções nativas do SA-MP (sem plugins), com salvamento em arquivo via fopen/fwrite." },
  { label: "Adicionar comandos de admin", prompt: "Adicione ao meu código um sistema de admin com /login, /kick, /ban, /curar e /ir, usando strcmp e verificação de permissão." },
  { label: "Explicar meu código", prompt: "Explique linha por linha o que o código do editor faz, em português simples." },
];

export function AiAssistant({ code, onInsertCode, onReplaceCode }: AiAssistantProps) {
  const ask = useServerFn(askPawnAi);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      setError(null);
      setInput("");
      const history: Msg[] = [...msgs, { id: Date.now(), role: "user", content: clean }];
      setMsgs(history);
      setBusy(true);
      try {
        const res = await ask({
          data: { messages: history.map(({ role, content }) => ({ role, content })), code },
        });
        if (res.ok) {
          setMsgs((prev) => [...prev, { id: Date.now() + 1, role: "assistant", content: res.content }]);
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(`Erro inesperado: ${String(e).slice(0, 160)}`);
      } finally {
        setBusy(false);
      }
    },
    [ask, busy, code, msgs],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3 text-[12.5px]">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted-foreground">
              🧠 <span className="text-foreground">IA Assistente PAWN</span> — treinada apenas em
              PAWN/SA-MP. Pede código, correção ou explicação e ela responde com sintaxe oficial.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUICK.map((q) => (
                <button
                  key={q.label}
                  onClick={() => void send(q.prompt)}
                  className="rounded-md border border-border bg-card/70 px-3 py-2 text-left transition-colors hover:border-primary hover:bg-accent"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-lg rounded-br-none bg-primary/25 px-3 py-2 whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <AssistantMessage
              key={m.id}
              content={m.content}
              onInsertCode={onInsertCode}
              onReplaceCode={onReplaceCode}
            />
          ),
        )}

        {busy && <p className="text-info">A IA está escrevendo o código…</p>}
        {error && <p className="text-destructive">{error}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex shrink-0 items-end gap-2 border-t border-border p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          placeholder="Ex: crie um sistema de casas com /comprarcasa e salvamento…"
          className="min-h-0 flex-1 resize-none rounded-md border border-border bg-input px-3 py-2 text-[12.5px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}

function AssistantMessage({
  content,
  onInsertCode,
  onReplaceCode,
}: {
  content: string;
  onInsertCode: (c: string) => void;
  onReplaceCode: (c: string) => void;
}) {
  const blocks = splitBlocks(content);
  return (
    <div className="max-w-full space-y-2 rounded-lg rounded-bl-none border border-border bg-card/70 px-3 py-2">
      {blocks.map((b, i) =>
        b.type === "code" ? (
          <div key={i} className="overflow-hidden rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-panel px-2 py-1 text-[11px]">
              <span className="text-muted-foreground">pawn</span>
              <button
                onClick={() => onInsertCode(b.text)}
                className="ml-auto rounded px-2 py-0.5 text-success hover:bg-accent"
              >
                Inserir no editor
              </button>
              <button
                onClick={() => onReplaceCode(b.text)}
                className="rounded px-2 py-0.5 text-warning hover:bg-accent"
              >
                Substituir tudo
              </button>
              <button
                onClick={() => void navigator.clipboard.writeText(b.text)}
                className="rounded px-2 py-0.5 text-muted-foreground hover:bg-accent"
              >
                Copiar
              </button>
            </div>
            <pre className="code-surface max-h-72 overflow-auto bg-editor px-3 py-2 whitespace-pre">
              {b.text}
            </pre>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {b.text}
          </p>
        ),
      )}
    </div>
  );
}

function splitBlocks(text: string): { type: "text" | "code"; text: string }[] {
  const out: { type: "text" | "code"; text: string }[] = [];
  const re = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index).trim();
    if (before) out.push({ type: "text", text: before });
    out.push({ type: "code", text: (m[1] ?? "").replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) out.push({ type: "text", text: rest });
  if (out.length === 0) out.push({ type: "text", text });
  return out;
}
