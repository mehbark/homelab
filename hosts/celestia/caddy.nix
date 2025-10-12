{ config, ... }:
let
  http-cat-error-handler = ''
  handle_errors {
    rewrite * /{err.status_code}
    reverse_proxy https://http.cat {
      header_up Host {upstream_hostport}
      replace_status {err.status_code}
    }
  }
  '';
  static-file-server = ''
  root * /srv/www
  encode zstd gzip
  file_server browse

  header *.tscn Content-Type application/x-godot-scene

  ${http-cat-error-handler}
  '';
  # we only use ports in string interpolation, so convert them all to strings here
  ports = builtins.mapAttrs (_: port: builtins.toString port) (import ./local-ports.nix) ;
in
{
  services.caddy = {
    enable = true;
    globalConfig = ''
      # nginx'll manage it for now :(
      auto_https off
    '';

    virtualHosts."celestia.pyrope.net:80".extraConfig = static-file-server;

    virtualHosts."cattenheimer.xyz:80".extraConfig = ''
      root * /srv/cattenheimer/root
      encode zstd gzip
      file_server browse

      ${http-cat-error-handler}
    '';

    virtualHosts."git.cattenheimer.xyz:80".extraConfig = ''
      reverse_proxy http://localhost:3000
    '';

    virtualHosts."puyo.cattenheimer.xyz:80".extraConfig = ''
      reverse_proxy http://localhost:${ports.puyo}
    '';

    virtualHosts."*.cattenheimer.xyz:80".extraConfig = ''
      root * /srv/cattenheimer/{http.request.host.labels.2}
      encode zstd gzip
      file_server browse

      ${http-cat-error-handler}
    '';

    virtualHosts."[200:8d39:e4de:d1da:f7f4:1626:2743:347b]:80".extraConfig = static-file-server;
  };
}
