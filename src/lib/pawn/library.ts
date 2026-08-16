// Biblioteca de funções Pawn/SA-MP prontas para inserção no editor.

export interface Snippet {
  name: string;
  description: string;
  code: string;
}

export interface SnippetCategory {
  id: string;
  label: string;
  icon: string;
  snippets: Snippet[];
}

export const SNIPPET_CATEGORIES: SnippetCategory[] = [
  {
    id: "basico",
    label: "Básico",
    icon: "◆",
    snippets: [
      {
        name: "Estrutura main()",
        description: "Ponto de entrada do script",
        code: `main()\n{\n    print("Script carregado com sucesso!");\n}\n`,
      },
      {
        name: "OnGameModeInit",
        description: "Inicialização do gamemode",
        code: `public OnGameModeInit()\n{\n    SetGameModeText("Meu Servidor");\n    AddPlayerClass(0, 1958.3783, 1343.1572, 15.3746, 269.1425, 0, 0, 0, 0, 0, 0);\n    return 1;\n}\n`,
      },
      {
        name: "OnGameModeExit",
        description: "Finalização do gamemode",
        code: `public OnGameModeExit()\n{\n    print("Gamemode finalizado.");\n    return 1;\n}\n`,
      },
      {
        name: "Timer repetitivo",
        description: "SetTimer com callback público",
        code: `forward AtualizarTudo();\npublic AtualizarTudo()\n{\n    for(new i = 0; i < MAX_PLAYERS; i++)\n    {\n        if(!IsPlayerConnected(i)) continue;\n        // sua lógica aqui\n    }\n    return 1;\n}\n\n// dentro de OnGameModeInit:\n// SetTimer("AtualizarTudo", 1000, true);\n`,
      },
    ],
  },
  {
    id: "jogador",
    label: "Jogador",
    icon: "☺",
    snippets: [
      {
        name: "OnPlayerConnect",
        description: "Mensagem de boas-vindas",
        code: `public OnPlayerConnect(playerid)\n{\n    new nome[MAX_PLAYER_NAME], msg[128];\n    GetPlayerName(playerid, nome, sizeof(nome));\n    format(msg, sizeof(msg), "{00FF00}%s (ID %d) entrou no servidor.", nome, playerid);\n    SendClientMessageToAll(-1, msg);\n    SendClientMessage(playerid, 0x33CCFFFF, "Bem-vindo ao servidor!");\n    return 1;\n}\n`,
      },
      {
        name: "OnPlayerSpawn",
        description: "Definir itens ao nascer",
        code: `public OnPlayerSpawn(playerid)\n{\n    SetPlayerHealth(playerid, 100.0);\n    GivePlayerWeapon(playerid, 24, 100);\n    SetPlayerInterior(playerid, 0);\n    return 1;\n}\n`,
      },
      {
        name: "OnPlayerDeath",
        description: "Recompensa por matar",
        code: `public OnPlayerDeath(playerid, killerid, reason)\n{\n    if(killerid != INVALID_PLAYER_ID)\n    {\n        GivePlayerMoney(killerid, 1000);\n        SetPlayerScore(killerid, GetPlayerScore(killerid) + 1);\n    }\n    return 1;\n}\n`,
      },
      {
        name: "Salvar posição",
        description: "GetPlayerPos + format",
        code: `new Float:x, Float:y, Float:z;\nGetPlayerPos(playerid, x, y, z);\nnew msg[128];\nformat(msg, sizeof(msg), "Posicao: %.2f, %.2f, %.2f", x, y, z);\nSendClientMessage(playerid, -1, msg);\n`,
      },
    ],
  },
  {
    id: "veiculos",
    label: "Veículos",
    icon: "⛟",
    snippets: [
      {
        name: "Criar veículo",
        description: "CreateVehicle no gamemode",
        code: `CreateVehicle(411, 1958.3783, 1343.1572, 15.3746, 269.1425, 1, 1, 600);\n`,
      },
      {
        name: "Comando /veiculo",
        description: "Cria e coloca o jogador dentro",
        code: `if(!strcmp(cmdtext, "/veiculo", true))\n{\n    new Float:x, Float:y, Float:z, Float:a;\n    GetPlayerPos(playerid, x, y, z);\n    GetPlayerFacingAngle(playerid, a);\n    new veiculo = CreateVehicle(411, x + 2.0, y, z, a, -1, -1, 600);\n    PutPlayerInVehicle(playerid, veiculo, 0);\n    SendClientMessage(playerid, 0x00FF00FF, "Veiculo criado!");\n    return 1;\n}\n`,
      },
      {
        name: "Reparar veículo",
        description: "Consertar o veículo atual",
        code: `if(!strcmp(cmdtext, "/consertar", true))\n{\n    if(!IsPlayerInAnyVehicle(playerid)) return SendClientMessage(playerid, 0xFF0000FF, "Voce nao esta em um veiculo.");\n    RepairVehicle(GetPlayerVehicleID(playerid));\n    SendClientMessage(playerid, 0x00FF00FF, "Veiculo consertado.");\n    return 1;\n}\n`,
      },
    ],
  },
  {
    id: "comandos",
    label: "Comandos",
    icon: "»",
    snippets: [
      {
        name: "OnPlayerCommandText",
        description: "Base com strcmp oficial",
        code: `public OnPlayerCommandText(playerid, cmdtext[])\n{\n    if(!strcmp(cmdtext, "/ajuda", true))\n    {\n        SendClientMessage(playerid, 0xFFFFFFFF, "Comandos: /ajuda /curar /grana");\n        return 1;\n    }\n    return 0;\n}\n`,
      },
      {
        name: "Comando com parâmetro",
        description: "sscanf manual com strtok",
        code: `if(!strcmp(cmdtext, "/grana", true, 6))\n{\n    new valor = strval(cmdtext[7]);\n    if(valor <= 0) return SendClientMessage(playerid, 0xFF0000FF, "Use: /grana [valor]");\n    GivePlayerMoney(playerid, valor);\n    return 1;\n}\n`,
      },
      {
        name: "Comando /curar",
        description: "Vida e colete cheios",
        code: `if(!strcmp(cmdtext, "/curar", true))\n{\n    SetPlayerHealth(playerid, 100.0);\n    SetPlayerArmour(playerid, 100.0);\n    SendClientMessage(playerid, 0x00FF00FF, "Vida e colete restaurados.");\n    return 1;\n}\n`,
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: "★",
    snippets: [
      {
        name: "Variável de admin",
        description: "Controle simples por array",
        code: `new bool:Admin[MAX_PLAYERS];\n\n// em OnPlayerConnect: Admin[playerid] = false;\n`,
      },
      {
        name: "Comando /kick",
        description: "Expulsar jogador por ID",
        code: `if(!strcmp(cmdtext, "/kick", true, 5))\n{\n    if(!Admin[playerid]) return SendClientMessage(playerid, 0xFF0000FF, "Voce nao é admin.");\n    new alvo = strval(cmdtext[6]);\n    if(!IsPlayerConnected(alvo)) return SendClientMessage(playerid, 0xFF0000FF, "Jogador invalido.");\n    Kick(alvo);\n    return 1;\n}\n`,
      },
      {
        name: "Comando /ban",
        description: "Banir jogador por ID",
        code: `if(!strcmp(cmdtext, "/ban", true, 4))\n{\n    if(!Admin[playerid]) return SendClientMessage(playerid, 0xFF0000FF, "Voce nao é admin.");\n    new alvo = strval(cmdtext[5]);\n    if(!IsPlayerConnected(alvo)) return SendClientMessage(playerid, 0xFF0000FF, "Jogador invalido.");\n    Ban(alvo);\n    return 1;\n}\n`,
      },
      {
        name: "Login de admin",
        description: "Senha fixa com strcmp",
        code: `if(!strcmp(cmdtext, "/login", true, 6))\n{\n    if(!strcmp(cmdtext[7], "senha123", false))\n    {\n        Admin[playerid] = true;\n        SendClientMessage(playerid, 0x00FF00FF, "Login de admin efetuado.");\n        return 1;\n    }\n    SendClientMessage(playerid, 0xFF0000FF, "Senha incorreta.");\n    return 1;\n}\n`,
      },
    ],
  },
  {
    id: "servidor",
    label: "Servidor",
    icon: "⛁",
    snippets: [
      {
        name: "Dialog de menu",
        description: "ShowPlayerDialog + resposta",
        code: `#define DIALOG_MENU 1000\n\nShowPlayerDialog(playerid, DIALOG_MENU, DIALOG_STYLE_LIST, "Menu", "Curar\\nGrana\\nTeleporte", "Escolher", "Sair");\n\npublic OnDialogResponse(playerid, dialogid, response, listitem, inputtext[])\n{\n    if(dialogid == DIALOG_MENU)\n    {\n        if(!response) return 1;\n        if(listitem == 0) SetPlayerHealth(playerid, 100.0);\n        if(listitem == 1) GivePlayerMoney(playerid, 5000);\n        if(listitem == 2) SetPlayerPos(playerid, 1958.3783, 1343.1572, 15.3746);\n        return 1;\n    }\n    return 0;\n}\n`,
      },
      {
        name: "Anúncio automático",
        description: "Timer com mensagens rotativas",
        code: `forward Anunciar();\npublic Anunciar()\n{\n    SendClientMessageToAll(0xFFCC00FF, "[INFO] Digite /ajuda para ver os comandos.");\n    return 1;\n}\n\n// SetTimer("Anunciar", 60000, true);\n`,
      },
      {
        name: "Modelo completo de servidor",
        description: "Gamemode base pronto para compilar",
        code: FULL_SERVER_TEMPLATE(),
      },
    ],
  },
];

export function FULL_SERVER_TEMPLATE(): string {
  return `/*
 * Modelo completo de servidor SA-MP
 * Gerado pelo PAWN MASTER PRO
 */

#include <a_samp>

#define COR_BRANCO   0xFFFFFFFF
#define COR_VERDE    0x00FF00FF
#define COR_VERMELHO 0xFF0000FF
#define COR_AZUL     0x33CCFFFF

#define DIALOG_MENU 1000

new bool:Admin[MAX_PLAYERS];

main()
{
    print("----------------------------------");
    print("  Servidor iniciado - MASTER PRO  ");
    print("----------------------------------");
}

public OnGameModeInit()
{
    SetGameModeText("Master Pro v1.0");
    ShowPlayerMarkers(1);
    ShowNameTags(1);
    EnableStuntBonusForAll(0);

    AddPlayerClass(0, 1958.3783, 1343.1572, 15.3746, 269.1425, 24, 100, 0, 0, 0, 0);
    AddPlayerClass(285, 1958.3783, 1343.1572, 15.3746, 269.1425, 31, 200, 0, 0, 0, 0);

    CreateVehicle(411, 1955.0, 1343.0, 15.5, 90.0, 1, 1, 600);
    CreateVehicle(522, 1950.0, 1343.0, 15.5, 90.0, 3, 3, 600);

    SetTimer("Anunciar", 60000, true);
    return 1;
}

public OnGameModeExit()
{
    print("Gamemode finalizado.");
    return 1;
}

forward Anunciar();
public Anunciar()
{
    SendClientMessageToAll(0xFFCC00FF, "[INFO] Digite /ajuda para ver todos os comandos.");
    return 1;
}

public OnPlayerConnect(playerid)
{
    new nome[MAX_PLAYER_NAME], msg[128];
    Admin[playerid] = false;
    GetPlayerName(playerid, nome, sizeof(nome));
    format(msg, sizeof(msg), "%s (ID %d) entrou no servidor.", nome, playerid);
    SendClientMessageToAll(COR_VERDE, msg);
    SendClientMessage(playerid, COR_AZUL, "Bem-vindo! Digite /ajuda para comecar.");
    return 1;
}

public OnPlayerDisconnect(playerid, reason)
{
    new nome[MAX_PLAYER_NAME], msg[128];
    GetPlayerName(playerid, nome, sizeof(nome));
    format(msg, sizeof(msg), "%s saiu do servidor.", nome);
    SendClientMessageToAll(COR_VERMELHO, msg);
    return 1;
}

public OnPlayerSpawn(playerid)
{
    SetPlayerHealth(playerid, 100.0);
    GivePlayerWeapon(playerid, 24, 100);
    return 1;
}

public OnPlayerDeath(playerid, killerid, reason)
{
    if(killerid != INVALID_PLAYER_ID)
    {
        GivePlayerMoney(killerid, 1000);
        SetPlayerScore(killerid, GetPlayerScore(killerid) + 1);
    }
    return 1;
}

public OnPlayerCommandText(playerid, cmdtext[])
{
    if(!strcmp(cmdtext, "/ajuda", true))
    {
        SendClientMessage(playerid, COR_BRANCO, "Comandos: /ajuda /menu /curar /veiculo /consertar");
        SendClientMessage(playerid, COR_BRANCO, "Admin: /login /kick /ban");
        return 1;
    }
    if(!strcmp(cmdtext, "/menu", true))
    {
        ShowPlayerDialog(playerid, DIALOG_MENU, DIALOG_STYLE_LIST, "Menu do Servidor", "Curar\\nGrana\\nTeleporte", "Escolher", "Sair");
        return 1;
    }
    if(!strcmp(cmdtext, "/curar", true))
    {
        SetPlayerHealth(playerid, 100.0);
        SetPlayerArmour(playerid, 100.0);
        SendClientMessage(playerid, COR_VERDE, "Vida e colete restaurados.");
        return 1;
    }
    if(!strcmp(cmdtext, "/veiculo", true))
    {
        new Float:x, Float:y, Float:z, Float:a;
        GetPlayerPos(playerid, x, y, z);
        GetPlayerFacingAngle(playerid, a);
        new veiculo = CreateVehicle(411, x + 2.0, y, z, a, -1, -1, 600);
        PutPlayerInVehicle(playerid, veiculo, 0);
        SendClientMessage(playerid, COR_VERDE, "Veiculo criado!");
        return 1;
    }
    if(!strcmp(cmdtext, "/consertar", true))
    {
        if(!IsPlayerInAnyVehicle(playerid)) return SendClientMessage(playerid, COR_VERMELHO, "Voce nao esta em um veiculo.");
        RepairVehicle(GetPlayerVehicleID(playerid));
        SendClientMessage(playerid, COR_VERDE, "Veiculo consertado.");
        return 1;
    }
    if(!strcmp(cmdtext, "/login", true, 6))
    {
        if(!strcmp(cmdtext[7], "senha123", false))
        {
            Admin[playerid] = true;
            SendClientMessage(playerid, COR_VERDE, "Login de admin efetuado.");
            return 1;
        }
        SendClientMessage(playerid, COR_VERMELHO, "Senha incorreta.");
        return 1;
    }
    if(!strcmp(cmdtext, "/kick", true, 5))
    {
        if(!Admin[playerid]) return SendClientMessage(playerid, COR_VERMELHO, "Voce nao e admin.");
        new alvo = strval(cmdtext[6]);
        if(!IsPlayerConnected(alvo)) return SendClientMessage(playerid, COR_VERMELHO, "Jogador invalido.");
        Kick(alvo);
        return 1;
    }
    if(!strcmp(cmdtext, "/ban", true, 4))
    {
        if(!Admin[playerid]) return SendClientMessage(playerid, COR_VERMELHO, "Voce nao e admin.");
        new alvo = strval(cmdtext[5]);
        if(!IsPlayerConnected(alvo)) return SendClientMessage(playerid, COR_VERMELHO, "Jogador invalido.");
        Ban(alvo);
        return 1;
    }
    return 0;
}

public OnDialogResponse(playerid, dialogid, response, listitem, inputtext[])
{
    if(dialogid == DIALOG_MENU)
    {
        if(!response) return 1;
        if(listitem == 0) SetPlayerHealth(playerid, 100.0);
        if(listitem == 1) GivePlayerMoney(playerid, 5000);
        if(listitem == 2) SetPlayerPos(playerid, 1958.3783, 1343.1572, 15.3746);
        return 1;
    }
    return 0;
}
`;
}
