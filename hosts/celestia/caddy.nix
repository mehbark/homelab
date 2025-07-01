{ ... }:
{
  services.caddy = {
    enable = true;
    globalConfig = ''
      # nginx'll manage it for now :(
      auto_https off
    '';
    virtualHosts."celestia.pyrope.net:80".extraConfig = ''
      root * /srv/www
      encode zstd gzip
      file_server browse
    '';
    virtualHosts."cattenheimer.xyz:80".extraConfig = ''
      respond "meow"
    '';
    virtualHosts."upload.cattenheimer.xyz:80".extraConfig = ''
      reverse_proxy http://localhost:8080
    '';
    virtualHosts."*.cattenheimer.xyz:80".extraConfig = ''
      handle_errors {
        rewrite * /{err.status_code}
        reverse_proxy https://http.cat {
          header_up Host {upstream_hostport}
          replace_status {err.status_code}
        }
      }

      root * /srv/cattenheimer/{http.request.host.labels.2}
      encode zstd gzip
      file_server browse
    '';
  };
}
