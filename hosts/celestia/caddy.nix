{ ... }:
let http-cat-error-handler = ''
  handle_errors {
    rewrite * /{err.status_code}
    reverse_proxy https://http.cat {
      header_up Host {upstream_hostport}
      replace_status {err.status_code}
    }
  }
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

      @silly path *.tscn
      header @silly Content-Type application/x-godot-scene
    '';
    virtualHosts."celestia.pyrope.net:80".extraConfig = ''
      root * /srv/www
      encode zstd gzip
      file_server browse

      ${http-cat-error-handler}
    '';
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
  };
}
