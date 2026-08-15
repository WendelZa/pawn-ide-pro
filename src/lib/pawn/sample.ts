export const SAMPLE_PWN = `/*
 * gamemode.pwn — exemplo gerado pela PAWN IDE
 * Compile com F5 e baixe o .amx pronto para o servidor.
 */

#include <a_samp>

#define COLOR_VERDE     0x33AA33AA
#define MAX_AVISOS      3

new g_TotalConexoes = 0;
new g_Avisos[MAX_PLAYERS];

forward AvisoGlobal(playerid);

main()
{
    print("----------------------------------");
    print("  Gamemode carregado com sucesso  ");
    print("----------------------------------");
}

public OnGameModeInit()
{
    SetGameModeText("PAWN IDE Demo");
    AddPlayerClass(0, 1958.3783, 1343.1572, 15.3746, 269.1425, 0, 0, 0, 0, 0, 0);
    return 1;
}

public OnPlayerConnect(playerid)
{
    new nome[MAX_PLAYER_NAME];
    GetPlayerName(playerid, nome, sizeof(nome));

    g_TotalConexoes++;
    g_Avisos[playerid] = 0;

    new msg[144];
    format(msg, sizeof(msg), "%s entrou no servidor (conexao #%d)", nome, g_TotalConexoes);
    SendClientMessageToAll(COLOR_VERDE, msg);
    return 1;
}

public OnPlayerSpawn(playerid)
{
    SetPlayerHealth(playerid, 100.0);
    GivePlayerMoney(playerid, 5000);
    SendClientMessage(playerid, COLOR_VERDE, "Bem-vindo! Use /ajuda para comecar.");
    return 1;
}

public OnPlayerCommandText(playerid, cmdtext[])
{
    if (!strcmp(cmdtext, "/ajuda", true))
    {
        SendClientMessage(playerid, COLOR_VERDE, "Comandos: /ajuda /curar /dinheiro");
        return 1;
    }
    if (!strcmp(cmdtext, "/curar", true))
    {
        SetPlayerHealth(playerid, 100.0);
        return 1;
    }
    return 0;
}

public AvisoGlobal(playerid)
{
    g_Avisos[playerid]++;
    if (g_Avisos[playerid] >= MAX_AVISOS)
    {
        Kick(playerid);
    }
    return 1;
}
`;
