// Conversor MTA:SA (Lua) -> SA-MP (Pawn). 100% no navegador, sem dependências.

export interface MtaInputFile {
  name: string;
  content: string;
}

export interface ConversionChange {
  file: string;
  line: number;
  from: string;
  to: string;
  rule: string;
}

export interface ConversionResult {
  pwn: string;
  changes: ConversionChange[];
  summary: {
    files: number;
    luaLines: number;
    pwnLines: number;
    commands: string[];
    events: string[];
    functions: string[];
    warnings: string[];
  };
}

interface Rule {
  id: string;
  re: RegExp;
  to: string;
}

// Mapeamento direto de funções MTA -> SA-MP
const FUNCTION_RULES: Rule[] = [
  { id: "outputChatBox → SendClientMessage", re: /\boutputChatBox\b/g, to: "SendClientMessage" },
  { id: "givePlayerMoney → GivePlayerMoney", re: /\bgivePlayerMoney\b/g, to: "GivePlayerMoney" },
  { id: "takePlayerMoney → GivePlayerMoney(-)", re: /\btakePlayerMoney\b/g, to: "GivePlayerMoney" },
  { id: "setPlayerMoney → ResetPlayerMoney", re: /\bsetPlayerMoney\b/g, to: "GivePlayerMoney" },
  { id: "getPlayerMoney → GetPlayerMoney", re: /\bgetPlayerMoney\b/g, to: "GetPlayerMoney" },
  { id: "getPlayerName → GetPlayerName", re: /\bgetPlayerName\b/g, to: "GetPlayerName" },
  { id: "setElementHealth → SetPlayerHealth", re: /\bsetElementHealth\b/g, to: "SetPlayerHealth" },
  { id: "getElementHealth → GetPlayerHealth", re: /\bgetElementHealth\b/g, to: "GetPlayerHealth" },
  { id: "setElementPosition → SetPlayerPos", re: /\bsetElementPosition\b/g, to: "SetPlayerPos" },
  { id: "getElementPosition → GetPlayerPos", re: /\bgetElementPosition\b/g, to: "GetPlayerPos" },
  { id: "setPlayerArmor → SetPlayerArmour", re: /\bsetPlayerArmou?r\b/g, to: "SetPlayerArmour" },
  { id: "giveWeapon → GivePlayerWeapon", re: /\bgiveWeapon\b/g, to: "GivePlayerWeapon" },
  { id: "takeAllWeapons → ResetPlayerWeapons", re: /\btakeAllWeapons\b/g, to: "ResetPlayerWeapons" },
  { id: "createVehicle → CreateVehicle", re: /\bcreateVehicle\b/g, to: "CreateVehicle" },
  { id: "destroyElement → DestroyVehicle", re: /\bdestroyElement\b/g, to: "DestroyVehicle" },
  { id: "createObject → CreateObject", re: /\bcreateObject\b/g, to: "CreateObject" },
  { id: "createPickup → CreatePickup", re: /\bcreatePickup\b/g, to: "CreatePickup" },
  { id: "createMarker → CreatePickup", re: /\bcreateMarker\b/g, to: "CreatePickup" },
  { id: "warpPedIntoVehicle → PutPlayerInVehicle", re: /\bwarpPedIntoVehicle\b/g, to: "PutPlayerInVehicle" },
  { id: "removePedFromVehicle → RemovePlayerFromVehicle", re: /\bremovePedFromVehicle\b/g, to: "RemovePlayerFromVehicle" },
  { id: "fixVehicle → RepairVehicle", re: /\bfixVehicle\b/g, to: "RepairVehicle" },
  { id: "kickPlayer → Kick", re: /\bkickPlayer\b/g, to: "Kick" },
  { id: "banPlayer → Ban", re: /\bbanPlayer\b/g, to: "Ban" },
  { id: "setTimer → SetTimer", re: /\bsetTimer\b/g, to: "SetTimer" },
  { id: "killTimer → KillTimer", re: /\bkillTimer\b/g, to: "KillTimer" },
  { id: "spawnPlayer → SpawnPlayer", re: /\bspawnPlayer\b/g, to: "SpawnPlayer" },
  { id: "setPlayerSkin → SetPlayerSkin", re: /\bsetElementModel\b/g, to: "SetPlayerSkin" },
  { id: "getPlayerCount → GetPlayerPoolSize", re: /\bgetPlayerCount\b/g, to: "GetPlayerPoolSize" },
  { id: "outputDebugString → print", re: /\boutputDebugString\b/g, to: "print" },
  { id: "outputServerLog → print", re: /\boutputServerLog\b/g, to: "print" },
  { id: "tostring → (string)", re: /\btostring\b/g, to: "" },
  { id: "tonumber → strval", re: /\btonumber\b/g, to: "strval" },
];

// Eventos MTA -> callbacks SA-MP
const EVENT_MAP: Record<string, string> = {
  onPlayerJoin: "OnPlayerConnect(playerid)",
  onPlayerQuit: "OnPlayerDisconnect(playerid, reason)",
  onPlayerSpawn: "OnPlayerSpawn(playerid)",
  onPlayerWasted: "OnPlayerDeath(playerid, killerid, reason)",
  onPlayerChat: "OnPlayerText(playerid, text[])",
  onPlayerCommand: "OnPlayerCommandText(playerid, cmdtext[])",
  onResourceStart: "OnGameModeInit()",
  onResourceStop: "OnGameModeExit()",
  onVehicleExplode: "OnVehicleDeath(vehicleid, killerid)",
  onPlayerVehicleEnter: "OnPlayerEnterVehicle(playerid, vehicleid, ispassenger)",
  onPlayerVehicleExit: "OnPlayerExitVehicle(playerid, vehicleid)",
  onPlayerDamage: "OnPlayerTakeDamage(playerid, issuerid, Float:amount, weaponid, bodypart)",
};

const COLOR_MAP: Record<string, string> = {
  "255, 0, 0": "0xFF0000FF",
  "0, 255, 0": "0x00FF00FF",
  "0, 0, 255": "0x0000FFFF",
  "255, 255, 255": "0xFFFFFFFF",
  "255, 255, 0": "0xFFFF00FF",
  "255, 165, 0": "0xFFA500FF",
};

function luaStringToPawn(s: string): string {
  // Lua usa .. para concatenar; Pawn usa format(). Convertemos concatenações
  // simples em placeholders de format para manter a lógica original.
  return s.replace(/'/g, '"');
}

/** Converte um bloco de corpo Lua em corpo Pawn (linha a linha). */
function convertBody(
  body: string,
  file: string,
  startLine: number,
  changes: ConversionChange[],
  indent: string,
): string {
  const out: string[] = [];
  const lines = body.split("\n");
  lines.forEach((raw, i) => {
    const lineNo = startLine + i;
    const original = raw.trim();
    if (!original) {
      out.push("");
      return;
    }
    let line = original;

    // comentários -- -> //
    if (line.startsWith("--")) {
      out.push(indent + "//" + line.slice(2));
      changes.push({ file, line: lineNo, from: original, to: "//" + line.slice(2), rule: "Comentário -- → //" });
      return;
    }
    line = line.replace(/--(?!\[)/g, "//");

    // local var = valor  ->  new var = valor;
    line = line.replace(/\blocal\s+([A-Za-z_]\w*)\s*=\s*/g, (_m, v) => {
      changes.push({ file, line: lineNo, from: "local " + v, to: "new " + v, rule: "Variável local → new" });
      return `new ${v} = `;
    });
    line = line.replace(/\blocal\s+([A-Za-z_]\w*)\s*$/g, "new $1");

    // operadores e palavras-chave
    line = line
      .replace(/\bthen\b/g, "")
      .replace(/\belseif\b/g, "else if")
      .replace(/\bnil\b/g, "0")
      .replace(/\bnot\s+/g, "!")
      .replace(/\band\b/g, "&&")
      .replace(/\bor\b/g, "||")
      .replace(/~=/g, "!=")
      .replace(/#(\w+)/g, "strlen($1)");

    // end -> }
    if (/^end\b/.test(line)) {
      out.push(indent + "}");
      return;
    }
    if (/^else\b/.test(line)) {
      out.push(indent.slice(0, -4) + "}");
      out.push(indent.slice(0, -4) + "else");
      out.push(indent.slice(0, -4) + "{");
      return;
    }

    // funções mapeadas
    for (const rule of FUNCTION_RULES) {
      if (rule.re.test(line)) {
        rule.re.lastIndex = 0;
        const before = line;
        line = line.replace(rule.re, rule.to);
        if (before !== line) changes.push({ file, line: lineNo, from: before, to: line, rule: rule.id });
      }
      rule.re.lastIndex = 0;
    }

    // cores RGB -> hex
    for (const [rgb, hex] of Object.entries(COLOR_MAP)) {
      if (line.includes(rgb)) line = line.split(rgb).join(hex);
    }

    // concatenação Lua -> format()
    if (/\.\./.test(line) && /SendClientMessage/.test(line)) {
      const inner = line.replace(/^\s*SendClientMessage\s*\(/, "").replace(/\)\s*;?\s*$/, "");
      const parts = inner.split(",");
      const target = (parts.shift() ?? "playerid").trim();
      const rest = parts.join(",");
      const pieces = rest.split("..").map((p) => p.trim());
      let fmt = "";
      const args: string[] = [];
      for (const p of pieces) {
        if (/^["'].*["']$/.test(p)) fmt += luaStringToPawn(p).slice(1, -1);
        else {
          fmt += "%s";
          args.push(p);
        }
      }
      const built =
        `new __msg[144];\n${indent}format(__msg, sizeof(__msg), "${fmt}"` +
        (args.length ? ", " + args.join(", ") : "") +
        `);\n${indent}SendClientMessage(${target}, -1, __msg);`;
      out.push(indent + built);
      changes.push({ file, line: lineNo, from: original, to: "format() + SendClientMessage", rule: "Concatenação Lua → format()" });
      return;
    }

    line = luaStringToPawn(line);

    // if/for abrem bloco
    if (/^(if|for|while)\b/.test(line)) {
      const cond = line.replace(/\s+$/, "");
      out.push(indent + cond.replace(/\s{2,}/g, " "));
      out.push(indent + "{");
      return;
    }

    if (!/[{};]$/.test(line) && !line.startsWith("//")) line += ";";
    out.push(indent + line);
  });
  return out.join("\n");
}

export function convertMtaToPawn(files: MtaInputFile[]): ConversionResult {
  const changes: ConversionChange[] = [];
  const commands: string[] = [];
  const events: string[] = [];
  const functions: string[] = [];
  const warnings: string[] = [];
  const commandBlocks: { cmd: string; body: string; fn: string }[] = [];
  const eventBlocks: { callback: string; body: string }[] = [];
  const otherFunctions: string[] = [];
  let luaLines = 0;

  for (const file of files) {
    const src = file.content.replace(/\r\n/g, "\n");
    luaLines += src.split("\n").length;

    // 1) funções nomeadas + corpo
    const funcRe = /function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)([\s\S]*?)\nend\b/g;
    const funcBodies = new Map<string, { params: string; body: string; line: number }>();
    let m: RegExpExecArray | null;
    while ((m = funcRe.exec(src))) {
      const line = src.slice(0, m.index).split("\n").length;
      funcBodies.set(m[1]!, { params: m[2] ?? "", body: m[3] ?? "", line });
      functions.push(`${file.name}: ${m[1]}()`);
    }

    // 2) comandos: addCommandHandler("cmd", handler)
    const cmdRe = /addCommandHandler\s*\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_]\w*)/g;
    while ((m = cmdRe.exec(src))) {
      const cmd = m[1]!;
      const handler = m[2]!;
      const fn = funcBodies.get(handler);
      commands.push(`/${cmd} → ${handler}()`);
      changes.push({
        file: file.name,
        line: src.slice(0, m.index).split("\n").length,
        from: `addCommandHandler("${cmd}", ${handler})`,
        to: `if(!strcmp(cmdtext, "/${cmd}", true))`,
        rule: "addCommandHandler → OnPlayerCommandText",
      });
      commandBlocks.push({
        cmd,
        fn: handler,
        body: fn ? convertBody(fn.body, file.name, fn.line, changes, "        ") : "        // corpo original não encontrado",
      });
      if (!fn) warnings.push(`Handler "${handler}" do comando /${cmd} não foi encontrado nos arquivos enviados.`);
    }

    // 3) eventos: addEventHandler("onPlayerJoin", root, handler)
    const evRe = /addEventHandler\s*\(\s*["']([^"']+)["']\s*,\s*[^,]+,\s*([A-Za-z_]\w*)/g;
    while ((m = evRe.exec(src))) {
      const ev = m[1]!;
      const handler = m[2]!;
      const callback = EVENT_MAP[ev];
      const fn = funcBodies.get(handler);
      events.push(`${ev} → ${callback ?? "não mapeado"}`);
      changes.push({
        file: file.name,
        line: src.slice(0, m.index).split("\n").length,
        from: `addEventHandler("${ev}", ..., ${handler})`,
        to: callback ? `public ${callback}` : `// evento ${ev} sem equivalente direto`,
        rule: "addEventHandler → Callback SA-MP",
      });
      if (!callback) {
        warnings.push(`Evento "${ev}" não possui callback SA-MP equivalente — lógica preservada como função auxiliar.`);
        if (fn) otherFunctions.push(`// evento MTA "${ev}" convertido em função auxiliar\nstock ${handler}(playerid)\n{\n${convertBody(fn.body, file.name, fn.line, changes, "    ")}\n    return 1;\n}`);
        continue;
      }
      eventBlocks.push({
        callback,
        body: fn ? convertBody(fn.body, file.name, fn.line, changes, "    ") : "    // corpo original não encontrado",
      });
    }

    // 4) funções restantes (não usadas por comando/evento)
    const used = new Set<string>([...commandBlocks.map((c) => c.fn)]);
    for (const [name, info] of funcBodies) {
      if (used.has(name)) continue;
      if (new RegExp(`addEventHandler[^\\n]*${name}`).test(src)) continue;
      otherFunctions.push(
        `stock ${name}(${info.params.split(",").map((p) => p.trim()).filter(Boolean).map((p) => (p === "source" || p === "player" || p === "thePlayer" ? "playerid" : p)).join(", ")})\n{\n${convertBody(info.body, file.name, info.line, changes, "    ")}\n    return 1;\n}`,
      );
    }

    // 5) veículos/objetos criados fora de funções
    const rootCreate = src.match(/^\s*(createVehicle|createObject|createPickup)\s*\([^)]*\)/gm);
    if (rootCreate) {
      for (const c of rootCreate) {
        changes.push({ file: file.name, line: 0, from: c.trim(), to: "movido para OnGameModeInit()", rule: "createVehicle/objeto → nativo em OnGameModeInit" });
      }
    }
  }

  // merge de eventos duplicados
  const merged = new Map<string, string[]>();
  for (const b of eventBlocks) {
    const arr = merged.get(b.callback) ?? [];
    arr.push(b.body);
    merged.set(b.callback, arr);
  }

  const parts: string[] = [];
  parts.push(`/*
 * Projeto convertido de MTA:SA (Lua) para SA-MP (Pawn)
 * Gerado por PAWN MASTER PRO — conversor MTA → SA-MP
 * Arquivos processados: ${files.length}
 */

#include <a_samp>

`);

  if (!merged.has("OnGameModeInit()")) {
    parts.push(`public OnGameModeInit()\n{\n    SetGameModeText("Convertido do MTA");\n    AddPlayerClass(0, 1958.3783, 1343.1572, 15.3746, 269.1425, 0, 0, 0, 0, 0, 0);\n    return 1;\n}\n`);
  }

  for (const [callback, bodies] of merged) {
    parts.push(`public ${callback}\n{\n${bodies.join("\n\n")}\n    return 1;\n}\n`);
  }

  if (commandBlocks.length) {
    const body = commandBlocks
      .map(
        (c) =>
          `    if(!strcmp(cmdtext, "/${c.cmd}", true))\n    {\n${c.body}\n        return 1;\n    }`,
      )
      .join("\n");
    parts.push(`public OnPlayerCommandText(playerid, cmdtext[])\n{\n${body}\n    return 0;\n}\n`);
  }

  if (otherFunctions.length) parts.push(otherFunctions.join("\n\n") + "\n");

  if (!merged.size && !commandBlocks.length && !otherFunctions.length) {
    warnings.push("Nenhum comando, evento ou função Lua foi reconhecido nos arquivos enviados.");
    parts.push(`main()\n{\n    print("Nada foi convertido: verifique os arquivos .lua enviados.");\n}\n`);
  }

  const pwn = parts.join("\n");

  return {
    pwn,
    changes,
    summary: {
      files: files.length,
      luaLines,
      pwnLines: pwn.split("\n").length,
      commands,
      events,
      functions,
      warnings,
    },
  };
}
