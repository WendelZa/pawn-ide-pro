import { createServerFn } from "@tanstack/react-start";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Você é o "PAWN MASTER", especialista exclusivo na linguagem PAWN para servidores SA-MP (San Andreas Multiplayer) e open.mp.

REGRAS ABSOLUTAS:
- Responda SEMPRE em português do Brasil.
- Use APENAS funções nativas reais do SA-MP (a_samp): SendClientMessage, GivePlayerMoney, SetPlayerPos, CreateVehicle, ShowPlayerDialog, SetTimer, format, strcmp, strval, etc.
- NUNCA invente funções, includes ou parâmetros inexistentes. Se algo exigir um plugin/include (sscanf2, zcmd, y_ini, mysql), diga isso explicitamente.
- Comandos por padrão usam OnPlayerCommandText com strcmp(cmdtext, "/cmd", true).
- Todo código deve compilar: chaves balanceadas, ponto-e-vírgula, forward antes de public em callbacks próprios, tamanho de arrays declarado, "new" para variáveis.
- Ao corrigir erros, mostre o código corrigido E explique o motivo do erro em lista curta.
- Ao criar sistemas, entregue o arquivo/parte completa, organizada e comentada em português.
- Use blocos de código markdown com a linguagem "pawn".
- Seja direto: código primeiro, explicação curta depois.`;

export const askPawnAi = createServerFn({ method: "POST" })
  .inputValidator((input: { messages: ChatTurn[]; code?: string }) => {
    if (!input || !Array.isArray(input.messages) || input.messages.length === 0) {
      throw new Error("Mensagens inválidas");
    }
    return {
      messages: input.messages.slice(-14).map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content).slice(0, 12000),
      })),
      code: typeof input.code === "string" ? input.code.slice(0, 20000) : "",
    };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "IA indisponível: chave não configurada." };

    const messages: { role: string; content: string }[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (data.code.trim()) {
      messages.push({
        role: "system",
        content: `Código atual aberto no editor do usuário (use como contexto ao corrigir ou adicionar funções):\n\n\`\`\`pawn\n${data.code}\n\`\`\``,
      });
    }
    messages.push(...data.messages);

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "google/gemini-3.6-flash", messages }),
      });

      if (res.status === 429) return { ok: false as const, error: "Limite de uso da IA atingido. Tente novamente em instantes." };
      if (res.status === 402) return { ok: false as const, error: "Créditos de IA insuficientes no workspace." };
      if (!res.ok) {
        const text = await res.text();
        return { ok: false as const, error: `Falha na IA (${res.status}): ${text.slice(0, 200)}` };
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      if (!content) return { ok: false as const, error: "A IA não retornou conteúdo." };
      return { ok: true as const, content };
    } catch (err) {
      return { ok: false as const, error: `Erro de rede ao falar com a IA: ${String(err).slice(0, 200)}` };
    }
  });
