{ lib, config, pkgs, ... }:
let basic-bot = name: src:
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
          ${pkgs.deno}/bin/deno --allow-net '--allow-read=${bot-config}' '${src}' '${bot-config}'
        '';
        Restart = "on-failure";
      };
    };
  };
in
lib.foldr lib.attrsets.recursiveUpdate {} [
  (basic-bot "mcai-checker" "${./mcai-checker.ts}")
  (basic-bot "puyo" "${./puyo.ts}")
]
