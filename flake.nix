{
  description = "homelab server flakes";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs = inputs @ {
    self,
    nixpkgs,
    flake-parts,
  }:
  flake-parts.lib.mkFlake {inherit inputs;} {
    systems = [
      "aarch64-darwin"
      "x86_64-linux"
    ];

    flake = {
      nixosConfigurations = {
        celestia = nixpkgs.lib.nixosSystem {
          system = "x86_64-linux";
          modules = [
            (import ./hosts/celestia/configuration.nix)
          ];
        };
      };
    };

    perSystem = {
      system,
      pkgs,
      ...
    }:
    let pkgs = import nixpkgs { inherit system; }; in
    {
      packages.deploy = pkgs.writeShellScriptBin "deploy" ''
        ${pkgs.nixos-rebuild}/bin/nixos-rebuild switch \
          --fast --flake .#$1 \
          --use-remote-sudo \
          --target-host mbk@$1 \
          --build-host mbk@$1
      '';
    };
  };
}
