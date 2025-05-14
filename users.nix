{
    mbk = {
      isNormalUser = true;
      description = "mehbark";
      extraGroups = [ "networkmanager" "wheel" ];
      initialPassword = "hunter2";
      openssh.authorizedKeys.keys = [
        "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICyTxPV3S7ms0AJ0tduI3aJP3o2TJCnkirWKaj5i1+DW"
      ];
    };
}
