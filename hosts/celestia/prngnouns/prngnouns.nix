{ pkgs, lib, ... }:
{
  systemd.services.prngnouns = {
    wantedBy = [ "multi-user.target" ];
    after = [ "network.target" ];
    unitConfig = {
      Description = "prngnouns web server";
      StartLimitIntervalSec = 30;
      StartLimitBurst = 5;
    };
    serviceConfig = {
      ExecStart = ''
        ${pkgs.deno}/bin/deno --allow-net \
          ${lib.escapeShellArg "${./prngnouns.ts}"}
      '';
      Restart = "on-failure";
    };
  };

  services.caddy.virtualHosts."prngnouns.cattenheimer.xyz:80".extraConfig = ''
    reverse_proxy :${toString (import ../local-ports.nix).prngnouns}
  '';
}
