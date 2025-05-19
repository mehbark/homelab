{ ... }:
{
  # currently nonfunctional because my vps with the public ipv4 is wack
  services.caddy = {
    enable = true;
    globalConfig = ''
      auto_https off
    '';
    virtualHosts.":80".extraConfig = ''
      root * /srv/www
      encode zstd gzip
      file_server browse
    '';
  };
}
