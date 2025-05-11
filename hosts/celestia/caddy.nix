{ ... }:
{
  # currently nonfunctional because my vps with the public ipv4 is wack
  services.caddy = {
    enable = true;
    globalConfig = ''
      auto_https disable_redirects
    '';
    virtualHosts."celestia.pyrope.net".extraConfig = ''
      respond "Hello, world!"
    '';
  };
}
