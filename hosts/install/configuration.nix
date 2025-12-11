{ pkgs, modulesPath, ... }:
{
  imports = [
    (modulesPath + "/installer/cd-dvd/installation-cd-graphical-calamares-plasma6.nix")
  ];

  # According to https://wiki.nixos.org/wiki/Creating_a_NixOS_live_CD,
  # this is ~4x faster for ~80% of the compression. worth it for me
  isoImage.squashfsCompression = "gzip -Xcompression-level 1";

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
