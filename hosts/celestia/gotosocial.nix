{ ... }:
let
  port = (import ./local-ports.nix).gotosocial;
in
{
  services.gotosocial = {
    enable = true;
    settings = {
      application-name = "cattenheimer.xyz for m,caiers";
      host = "cattenheimer.xyz";

      db-address = "/srv/gotosocial/database.sqlite";
      storage-local-base-path = "/srv/gotosocial/storage";
      inherit port;
    };
  };

  services.caddy.virtualHosts."social.cattenheimer.xyz:80".extraConfig = ''
    reverse_proxy :${toString port}
  '';
}
