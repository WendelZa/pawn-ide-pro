// Pawn source analyzer + .amx emitter. Pure TS, runs entirely in the browser.

import { NATIVES, tokenize, type Token } from "./lexer";
import { buildAmx } from "./amx";

export type Severity = "error" | "warning" | "info" | "success";

export interface Diagnostic {
  severity: Severity;
  line: number;
  col: number;
  code: string;
  message: string;
}

export interface LogLine {
  severity: Severity;
  text: string;
}

export interface CompileResult {
  ok: boolean;
  diagnostics: Diagnostic[];
  log: LogLine[];
  amx: Uint8Array | null;
  stats: {
    lines: number;
    tokens: number;
    publics: string[];
    natives: string[];
    globals: string[];
    forwards: string[];
    includes: string[];
    codeSize: number;
    dataSize: number;
    durationMs: number;
  };
}

const CALLBACKS = new Set([
  "main", "OnGameModeInit", "OnGameModeExit", "OnPlayerConnect", "OnPlayerDisconnect",
  "OnPlayerSpawn", "OnPlayerDeath", "OnPlayerText", "OnPlayerCommandText",
  "OnPlayerRequestClass", "OnPlayerEnterVehicle", "OnPlayerExitVehicle",
  "OnPlayerStateChange", "OnPlayerUpdate", "OnFilterScriptInit", "OnFilterScriptExit",
  "OnDialogResponse", "OnPlayerKeyStateChange", "OnVehicleSpawn", "OnVehicleDeath",
]);

export function compilePawn(source: string, fileName = "untitled.pwn"): CompileResult {
  const started = performance.now();
  const log: LogLine[] = [];
  const diagnostics: Diagnostic[] = [];
  const add = (d: Diagnostic) => diagnostics.push(d);
  const say = (text: string, severity: Severity = "info") => log.push({ severity, text });

  say(`Pawn compiler 3.2.3664 (web) — Copyright (c) 1997-2026, ITB CompuPhase`);
  say(`> Entrada: ${fileName}`);
  say(`[1/6] Pré-processamento...`);

  const lines = source.split("\n");
  const tokens = tokenize(source);
  const code = tokens.filter((t) => t.kind !== "whitespace" && t.kind !== "comment");

  // ---------- 1. unterminated literals / comments ----------
  for (const t of tokens) {
    if (t.kind === "comment" && t.value.startsWith("/*") && !t.value.endsWith("*/")) {
      add({ severity: "error", line: t.line, col: t.col, code: "error 002", message: "comentário de bloco não terminado (*/ ausente)" });
    }
    if (t.kind === "string" && (t.value.length < 2 || !t.value.endsWith('"'))) {
      add({ severity: "error", line: t.line, col: t.col, code: "error 037", message: "literal de string inválido (aspas não fechadas)" });
    }
    if (t.kind === "char" && (t.value.length < 3 || !t.value.endsWith("'"))) {
      add({ severity: "error", line: t.line, col: t.col, code: "error 027", message: "constante de caractere inválida" });
    }
  }

  // ---------- 2. directives ----------
  const includes: string[] = [];
  for (const t of tokens) {
    if (t.kind !== "directive") continue;
    const m = /^#\s*([a-z]+)\s*(.*)$/s.exec(t.value);
    if (!m) {
      add({ severity: "error", line: t.line, col: t.col, code: "error 010", message: "diretiva de pré-processador inválida" });
      continue;
    }
    const [, name, argRaw] = m;
    const arg = (argRaw ?? "").trim();
    const known = ["include", "tryinclude", "define", "undef", "if", "else", "elseif", "endif", "pragma", "emit", "error", "warning", "assert", "endinput", "file", "line"];
    if (!known.includes(name!)) {
      add({ severity: "error", line: t.line, col: t.col, code: "error 010", message: `diretiva desconhecida: #${name}` });
      continue;
    }
    if (name === "include" || name === "tryinclude") {
      const inc = /^[<"]([^">]+)[">]/.exec(arg);
      if (!inc) {
        add({ severity: "error", line: t.line, col: t.col, code: "error 037", message: "nome de arquivo inválido em #include" });
      } else {
        includes.push(inc[1]!);
        say(`      #include <${inc[1]}>`);
      }
    }
    if (name === "define" && !arg) {
      add({ severity: "error", line: t.line, col: t.col, code: "error 038", message: "#define sem identificador" });
    }
  }
  if (!includes.some((i) => /a_samp|a_sampdb|open\.mp|YSI/i.test(i))) {
    add({ severity: "warning", line: 1, col: 1, code: "warning 203", message: "nenhum include base encontrado (#include <a_samp>)" });
  }

  say(`[2/6] Análise léxica... ${code.length} tokens em ${lines.length} linhas`);

  // ---------- 3. balancing ----------
  say(`[3/6] Verificando balanceamento de blocos...`);
  const stack: Token[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (const t of code) {
    if (t.kind !== "punct") continue;
    if ("([{".includes(t.value)) stack.push(t);
    else if (")]}".includes(t.value)) {
      const open = stack.pop();
      if (!open) {
        add({ severity: "error", line: t.line, col: t.col, code: "error 054", message: `'${t.value}' sem abertura correspondente` });
      } else if (open.value !== pairs[t.value]) {
        add({ severity: "error", line: t.line, col: t.col, code: "error 054", message: `esperado '${closerOf(open.value)}' mas encontrado '${t.value}'` });
      }
    }
  }
  for (const open of stack) {
    add({ severity: "error", line: open.line, col: open.col, code: "error 030", message: `'${open.value}' aberto e nunca fechado` });
  }

  // ---------- 4. declarations ----------
  say(`[4/6] Coletando símbolos (public / forward / native / stock)...`);
  const publics: string[] = [];
  const forwards: string[] = [];
  const nativesFound: string[] = [];
  const globals: string[] = [];
  const definedFns = new Set<string>();
  const calls: Token[] = [];

  for (let i = 0; i < code.length; i++) {
    const t = code[i]!;
    const next = code[i + 1];
    const next2 = code[i + 2];

    if (t.kind === "keyword" && (t.value === "public" || t.value === "forward" || t.value === "native" || t.value === "stock")) {
      // skip optional return tag: `public Float:Foo(`
      let j = i + 1;
      if (code[j] && code[j + 1]?.value === ":") j += 2;
      const nameTok = code[j];
      if (!nameTok || !isName(nameTok)) {
        add({ severity: "error", line: t.line, col: t.col, code: "error 020", message: `nome de símbolo inválido após '${t.value}'` });
        continue;
      }
      if (code[j + 1]?.value !== "(") {
        if (t.value === "public") {
          globals.push(nameTok.value);
          continue;
        }
        add({ severity: "error", line: nameTok.line, col: nameTok.col, code: "error 010", message: `esperado '(' na declaração de '${nameTok.value}'` });
        continue;
      }
      if (t.value === "public") {
        publics.push(nameTok.value);
        definedFns.add(nameTok.value);
      } else if (t.value === "forward") {
        forwards.push(nameTok.value);
      } else if (t.value === "native") {
        nativesFound.push(nameTok.value);
        definedFns.add(nameTok.value);
      } else {
        definedFns.add(nameTok.value);
      }
      continue;
    }

    if (t.kind === "keyword" && t.value === "new" && next && isName(next)) {
      globals.push(next.value);
      continue;
    }

    // plain function definition at top level: Name(...) {
    if (isName(t) && next?.value === "(" && (i === 0 || isStatementStart(code[i - 1]!))) {
      definedFns.add(t.value);
    }

    if (isName(t) && next?.value === "(") calls.push(t);
    void next2;
  }

  if (!definedFns.has("main") && !publics.includes("main") && !includes.some((i) => /a_samp/.test(i) && false)) {
    if (!/\bmain\s*\(/.test(source)) {
      add({ severity: "warning", line: 1, col: 1, code: "warning 203", message: "função 'main' não encontrada — obrigatória em gamemodes" });
    }
  }

  // undefined symbol detection
  for (const c of calls) {
    const name = c.value;
    if (definedFns.has(name) || NATIVES.has(name) || CALLBACKS.has(name) || forwards.includes(name)) continue;
    if (/^(if|while|for|switch|return|sizeof|tagof|case|defined|assert|strlen|printf|print)$/.test(name)) continue;
    if (isKnownMacro(name, source)) continue;
    add({ severity: "warning", line: c.line, col: c.col, code: "warning 235", message: `'${name}' não possui protótipo visível (declare com forward/native)` });
  }

  for (const f of forwards) {
    if (!publics.includes(f)) {
      add({ severity: "warning", line: 1, col: 1, code: "warning 233", message: `'${f}' declarado com forward mas nunca implementado como public` });
    }
  }

  // ---------- 5. statement sanity ----------
  // Trabalha sobre uma versão "mascarada": comentários e literais viram espaços,
  // então comentários de bloco de múltiplas linhas nunca geram falso positivo.
  say(`[5/6] Verificação sintática...`);
  const maskedLines = maskSource(source, tokens).split("\n");
  maskedLines.forEach((maskedRaw, idx) => {
    const l = maskedRaw.trim();
    if (!l || l.startsWith("#")) return;

    const indented = /^[ \t]/.test(maskedRaw);
    const isBlockKeyword = /^(if|else|for|while|do|switch|case|default|public|stock|forward|native|enum|const|static|new|return|delete)\b/.test(l);
    const endsOpen = /[{};:,\\]$/.test(l);

    const needsSemi =
      !endsOpen &&
      (/^(new|return|delete)\b/.test(l) ||
        (indented && /[)\]\w]$/.test(l) && !isBlockKeyword));

    if (needsSemi) {
      add({ severity: "error", line: idx + 1, col: maskedRaw.length, code: "error 001", message: "esperado token ';'" });
    }
    if (/^(if|while|switch)\s*[^(\s]/.test(l)) {
      add({ severity: "error", line: idx + 1, col: 1, code: "error 029", message: "expressão inválida, esperado '('" });
    }
    if (/[^=!<>+\-*/%]=\s*;/.test(l)) {
      add({ severity: "error", line: idx + 1, col: l.indexOf("=") + 1, code: "error 029", message: "expressão inválida após '='" });
    }
    if (/\bif\s*\(\s*[A-Za-z_]\w*\s*=[^=]/.test(l)) {
      add({ severity: "warning", line: idx + 1, col: 1, code: "warning 211", message: "atribuição possivelmente confundida com comparação ('=' vs '==')" });
    }
  });


  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");

  say(`[6/6] Geração de código AMX...`);
  let amx: Uint8Array | null = null;
  if (errors.length === 0) {
    amx = buildAmx({
      publics: publics.length ? publics : ["main"],
      natives: dedupe([...nativesFound, ...calls.map((c) => c.value).filter((n) => NATIVES.has(n))]),
      globals: dedupe(globals),
    });
    say(`      header AMX v8 escrito (${amx.length} bytes)`, "success");
    say(`      publics: ${publics.length} · natives: ${nativesFound.length} · globais: ${dedupe(globals).length}`);
  } else {
    say(`      abortado: ${errors.length} erro(s) impedem a geração do .amx`, "error");
  }

  const durationMs = Math.max(1, Math.round(performance.now() - started));

  if (errors.length === 0) {
    say(`Compilação concluída em ${durationMs} ms — ${warnings.length} aviso(s), 0 erro(s).`, "success");
  } else {
    say(`Compilação falhou em ${durationMs} ms — ${errors.length} erro(s), ${warnings.length} aviso(s).`, "error");
  }

  return {
    ok: errors.length === 0,
    diagnostics: diagnostics.sort((a, b) => a.line - b.line || a.col - b.col),
    log,
    amx,
    stats: {
      lines: lines.length,
      tokens: code.length,
      publics,
      natives: dedupe(nativesFound),
      globals: dedupe(globals),
      forwards,
      includes,
      codeSize: amx ? amx.length : 0,
      dataSize: dedupe(globals).length * 4,
      durationMs,
    },
  };
}

function closerOf(open: string) {
  return open === "(" ? ")" : open === "[" ? "]" : "}";
}

function isName(t: Token) {
  return t.kind === "identifier" || t.kind === "function" || t.kind === "native" || t.kind === "constant" || t.kind === "type";
}

function isStatementStart(prev: Token) {
  return prev.kind === "punct" && ("};".includes(prev.value) || prev.value === "{");
}

function isKnownMacro(name: string, source: string) {
  return new RegExp(`#define\\s+${escapeRe(name)}\\b`).test(source) || new RegExp(`\\bforward\\s+(?:\\w+:)?${escapeRe(name)}\\s*\\(`).test(source);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripComments(line: string) {
  return line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
}

function dedupe(a: string[]) {
  return Array.from(new Set(a.filter(Boolean)));
}
