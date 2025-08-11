{ lib, config, pkgs, ... }:
let basic-bot = name: src: { additionalArgs ? [] }:
  let
    cfg = config.bots.discord.${name};
    bot-config = "/home/mbk/bots/discord/${name}.json";
  in {
    options.bots.discord.${name}.enable = lib.mkEnableOption "enable the ${name} discord bot";

    config.systemd.services."bot.discord.${name}" = lib.mkIf cfg.enable {
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];
      unitConfig = {
        Description = "${name} discord bot";
        StartLimitIntervalSec = 30;
        StartLimitBurst = 5;
      };
      serviceConfig = {
        ExecStart = ''
          ${pkgs.deno}/bin/deno \
             ${lib.escapeShellArgs additionalArgs} \
             --allow-net --allow-read=${lib.escapeShellArg bot-config} \
             --allow-env\
             ${lib.escapeShellArg src} ${lib.escapeShellArg bot-config}
        '';
        Restart = "on-failure";
        RuntimeMaxSec = "600s";
      };
    };
  };
in
lib.foldr lib.attrsets.recursiveUpdate {} [
  (basic-bot "mcai-checker" "${./mcai-checker.ts}" {})
  (basic-bot "puyo" "${./puyo.ts}" {
    additionalArgs = [
      "--unstable-kv"
      "--allow-run"
      "--allow-read=/home/mbk/bots/discord/puyo.kv"
      "--allow-read=/home/mbk/bots/discord/dr-dump.txt"
      "--allow-write=/home/mbk/bots/discord/puyo.kv"
    ];
  })
]
