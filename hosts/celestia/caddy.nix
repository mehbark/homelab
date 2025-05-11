{ ... }:
{
  # currently nonfunctional because my vps with the public ipv4 is wack
  services.caddy = {
    enable = true;
    virtualHosts."celestia.pyrope.net".extraConfig = ''
      respond "Hello, world!"
    '';
  };
}
