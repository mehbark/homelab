{ lib, config, pkgs, ... }:
let basic-bot = name: src:
  let
    cfg = config.bots.discord.${name};
    bot-config = "/home/mbk/bots/discord/${name}.json";
  in {
    options.bots.discord.${name}.enable = lib.mkEnableOption "enable the ${name} discord bot";

    config = {
      systemd.services.${name} = lib.mkIf cfg.enable {
        wantedBy = [ "multi-user.target" ];
        after = [ "network.target" ];
        serviceConfig = {
          ExecStart = ''
            ${pkgs.deno}/bin/deno --allow-net '--allow-read=${bot-config}' '${src}' '${bot-config}'
          '';
        };
      };
    };
  }; in
# TODO: i'm fairly sure this will break for as few as literally two bots. fix!
lib.attrsets.mergeAttrsList [
  (basic-bot "mcai-checker" "${./mcai-checker.ts}")
]
