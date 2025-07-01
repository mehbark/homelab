{ ... }:
{
  services.caddy = {
    enable = true;
    globalConfig = ''
      # nginx'll manage it for now :(
      auto_https off
      encode zstd gzip
    '';
    virtualHosts."celestia.pyrope.net:80".extraConfig = ''
      root * /srv/www
      encode zstd gzip
      file_server browse
    '';
    virtualHosts."cattenheimer.xyz:80".extraConfig = ''
      respond "meow"
    '';
    virtualHosts."*.cattenheimer.xyz:80".extraConfig = ''
      respond "subdomain meow"
    '';
  };
}
