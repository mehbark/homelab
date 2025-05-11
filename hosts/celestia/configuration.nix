{ pkgs, ... }:
{
  imports = [
    ./hardware-configuration.nix
    ./firewall.nix
    ./tailscale.nix
    ./caddy.nix
    ./nix.nix
  ];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "celestia";
  services.openssh.enable = true;

  networking.networkmanager.enable = true;

  system.stateVersion = "24.11";

  users.users = {
    root = {
      initialPassword = "hunter2";
    };

    mbk = {
      isNormalUser = true;
      description = "mehbark";
      extraGroups = [ "networkmanager" "wheel" ];
      initialPassword = "hunter2";
      openssh.authorizedKeys.keys = [
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICyTxPV3S7ms0AJ0tduI3aJP3o2TJCnkirWKaj5i1+DW"
      ];
    };
  };
}
