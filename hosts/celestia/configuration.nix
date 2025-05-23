{ pkgs, ... }:
{
  imports = [
    ./hardware-configuration.nix
    ./firewall.nix
    ./tailscale.nix
    ./caddy.nix
    ./nix.nix
    ./openssh.nix
  ];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "celestia";

  system.stateVersion = "24.11";

  security.sudo.wheelNeedsPassword = false;

  users.users = import ../../users.nix;
}
