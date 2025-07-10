{ pkgs, ... }:
{
  imports = [
    ./caddy.nix
    ./firewall.nix
    ./hardware-configuration.nix
    ./nix.nix
    ./ollama.nix
    ./openssh.nix
    ./tailscale.nix
    ../../bots/discord.nix
  ];

  bots.discord.mcai-checker.enable = true;
  bots.discord.puyo.enable = true;

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "celestia";

  system.stateVersion = "24.11";

  security.sudo.wheelNeedsPassword = false;

  users.users = import ../../users.nix;
}
