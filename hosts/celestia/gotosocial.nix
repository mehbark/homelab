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

      # WL stuff (not everything is the same though)
      instance-federation-mode = "allowlist";
      instance-inject-mastodon-version = true;
      instance-languages = ["en"];
      accounts-allow-custom-css = true;
      statuses-max-chars = 50000;
    };
  };

  services.caddy.virtualHosts."cattenheimer.xyz:80".extraConfig = ''
    reverse_proxy :${toString port}
  '';
}
