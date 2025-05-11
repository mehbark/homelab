{
  description = "homelab server flakes";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixos-generators = {
      url = "github:nix-community/nixos-generators";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs @ {
    self,
    nixpkgs,
    flake-parts,
    nixos-generators,
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

      # TODO: generic iso generation
      packages.celestia-installer = nixos-generators.nixosGenerate {
        system = "x86_64-linux";
        modules = [
          {
            nix.registry.nixpkgs.flake = nixpkgs;
          }
          (import ./hosts/celestia/configuration.nix)
        ];
        format = "install-iso";
      };
    };
  };
}
