{ pkgs, modulesPath, ... }:
{
  imports = [
    (modulesPath + "/installer/cd-dvd/installation-cd-minimal.nix")
  ];

  environment.systemPackages = [
    pkgs.neovim
  ];

  # TODO: exactly duplicated from hosts/celestia
  services.openssh = {
    enable = true;
    settings.PasswordAuthentication = false;
  };

  services.tailscale.enable = true;
  networking.firewall.trustedInterfaces = [ "tailscale0" ];

  networking.hostName = "install";
  system.stateVersion = "25.11";

  security.sudo.wheelNeedsPassword = false;

  users.users = import ../../users.nix;
}
