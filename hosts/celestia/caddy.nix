{ ... }:
{
  # currently nonfunctional because my vps with the public ipv4 is wack
  services.caddy = {
    enable = true;
    globalConfig = ''
      auto_https off
    '';
    virtualHosts."celestia.pyrope.net:80".extraConfig = ''
      respond "Hello, world!"
    '';
  };
}
