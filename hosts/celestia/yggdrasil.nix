{ config, ... }:
let
  address = "200:8d39:e4de:d1da:f7f4:1626:2743:347b";
  prefix = "300:8d39:e4de:d1da";
in
{
  services.yggdrasil = {
    enable = true;

    persistentKeys = true;

    settings = {
      Peers = [
        "tls://ygg.jjolly.dev:3443"
        "quic://129.80.167.244:23165"
        "quic://mn.us.ygg.triplebit.org:443"
      ];

      NodeInfo = {
        name = config.networking.hostName;
      };
    };
  };

  boot.kernel.sysctl."net.ipv6.conf.all.forwarding" = 1;

  networking.interfaces.enp2s0.ipv6.addresses = [
    {
      address = prefix + "::";
      prefixLength = 64;
    }
  ];

  services.radvd = {
    # Announce the 300::/8 prefix to eth0.
    enable = true;
    config = ''
      interface enp2s0
      {
        AdvSendAdvert on;
        prefix ${prefix}::/64 {
          AdvOnLink on;
          AdvAutonomous on;
        };
        route 200::/8 {};
      };
    '';
  };
}
