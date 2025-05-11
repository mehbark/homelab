{ ... }:
{
  # currently nonfunctional because my vps with the public ipv4 is wack
  services.caddy = {
    enable = true;
    globalConfig = ''
      auto_https off
    '';
    virtualHosts."http://celestia.pyrope.net".extraConfig = ''
      root * /var/www/static
      file_server browse
    '';
  };
}
