// Pawn (.pwn) lexer + syntax highlighter. Pure TS, no dependencies.

export type TokenKind =
  | "comment"
  | "string"
  | "char"
  | "number"
  | "directive"
  | "keyword"
  | "type"
  | "constant"
  | "native"
  | "function"
  | "operator"
  | "punct"
  | "identifier"
  | "whitespace";

export interface Token {
  kind: TokenKind;
  value: string;
  line: number;
  col: number;
  index: number;
}

export const KEYWORDS = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break",
  "continue", "return", "goto", "sizeof", "tagof", "state", "const", "static",
  "stock", "public", "native", "forward", "new", "enum", "operator", "defined",
  "assert", "exit", "emit", "__emit",
]);

export const TYPES = new Set(["Float", "bool", "File", "Text", "Text3D", "Menu", "DB", "DBResult", "any", "_"]);

export const CONSTANTS = new Set([
  "true", "false", "cellmax", "cellmin", "charmax", "charmin", "EOS",
  "INVALID_PLAYER_ID", "INVALID_VEHICLE_ID", "MAX_PLAYERS", "MAX_PLAYER_NAME",
  "PLAYER_STATE_ONFOOT", "COLOR_WHITE", "NULL",
]);

export const NATIVES = new Set([
  "print", "printf", "format", "strlen", "strcmp", "strcat", "strfind", "strval",
  "strmid", "strins", "strdel", "floatstr", "floatround", "floatsqroot", "random",
  "SendClientMessage", "SendClientMessageToAll", "GetPlayerName", "SetPlayerPos",
  "GetPlayerPos", "SetPlayerHealth", "GetPlayerHealth", "GivePlayerMoney",
  "GetPlayerMoney", "ResetPlayerMoney", "SetPlayerSkin", "GetPlayerSkin",
  "CreateVehicle", "DestroyVehicle", "PutPlayerInVehicle", "AddPlayerClass",
  "SetGameModeText", "SetPlayerInterior", "SetPlayerColor", "GetPlayerColor",
  "SetTimer", "SetTimerEx", "KillTimer", "SetPlayerVirtualWorld", "Kick", "Ban",
  "GameTextForPlayer", "GameTextForAll", "IsPlayerConnected", "SpawnPlayer",
  "TogglePlayerControllable", "SetPlayerCameraPos", "SetPlayerCameraLookAt",
  "GivePlayerWeapon", "ResetPlayerWeapons", "SetPlayerWantedLevel",
  "CallLocalFunction", "CallRemoteFunction", "SetPlayerScore", "GetPlayerScore",
]);

const OPERATOR_CHARS = "+-*/%=!<>&|^~?:";

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const push = (kind: TokenKind, value: string) => {
    tokens.push({ kind, value, line, col, index: i });
    for (const ch of value) {
      if (ch === "\n") {
        line++;
        col = 1;
      } else col++;
    }
    i += value.length;
  };

  while (i < src.length) {
    const ch = src[i]!;
    const rest = src.slice(i);

    // whitespace
    if (/\s/.test(ch)) {
      const m = /^\s+/.exec(rest)!;
      push("whitespace", m[0]);
      continue;
    }
    // line comment
    if (rest.startsWith("//")) {
      const end = rest.indexOf("\n");
      push("comment", end === -1 ? rest : rest.slice(0, end));
      continue;
    }
    // block comment
    if (rest.startsWith("/*")) {
      const end = rest.indexOf("*/", 2);
      push("comment", end === -1 ? rest : rest.slice(0, end + 2));
      continue;
    }
    // preprocessor directive
    if (ch === "#") {
      const end = rest.indexOf("\n");
      let raw = end === -1 ? rest : rest.slice(0, end);
      // support line continuation
      while (raw.endsWith("\\")) {
        const nextStart = i + raw.length + 1;
        const nextEnd = src.indexOf("\n", nextStart);
        raw += "\n" + (nextEnd === -1 ? src.slice(nextStart) : src.slice(nextStart, nextEnd));
      }
      push("directive", raw);
      continue;
    }
    // string
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === '"' || src[j] === "\n") break;
        j++;
      }
      const closed = src[j] === '"';
      push("string", src.slice(i, closed ? j + 1 : j));
      continue;
    }
    // char literal
    if (ch === "'") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === "'" || src[j] === "\n") break;
        j++;
      }
      const closed = src[j] === "'";
      push("char", src.slice(i, closed ? j + 1 : j));
      continue;
    }
    // number
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|[0-9][0-9_]*(\.[0-9_]+)?([eE][+-]?[0-9]+)?)/.exec(rest)!;
      push("number", m[0]);
      continue;
    }
    // identifier
    if (/[A-Za-z_@]/.test(ch)) {
      const m = /^[A-Za-z0-9_@]+/.exec(rest)!;
      const word = m[0];
      let kind: TokenKind = "identifier";
      if (KEYWORDS.has(word)) kind = "keyword";
      else if (TYPES.has(word)) kind = "type";
      else if (CONSTANTS.has(word) || /^[A-Z0-9_]{2,}$/.test(word)) kind = "constant";
      else if (NATIVES.has(word)) kind = "native";
      else {
        // function call heuristic
        const after = rest.slice(word.length);
        if (/^\s*\(/.test(after)) kind = "function";
      }
      push(kind, word);
      continue;
    }
    // operator
    if (OPERATOR_CHARS.includes(ch)) {
      const m = /^[+\-*/%=!<>&|^~?:]+/.exec(rest)!;
      push("operator", m[0]);
      continue;
    }
    push("punct", ch);
  }

  return tokens;
}

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ESCAPE[c]!);
}

/** Returns highlighted HTML for the source, safe to inject (all text escaped). */
export function highlight(src: string): string {
  let out = "";
  for (const t of tokenize(src)) {
    if (t.kind === "whitespace") out += esc(t.value);
    else out += `<span class="tk-${t.kind}">${esc(t.value)}</span>`;
  }
  return out + "\n";
}
