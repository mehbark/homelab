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

        derpy = nixpkgs.lib.nixosSystem {
          system = "x86_64-linux";
          modules = [
            (import ./hosts/derpy/configuration.nix)
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
        TARGET_HOST="$1"
        BUILD_HOST="''${2:-$TARGET_HOST}"

        echo "building on $BUILD_HOST and deploying to $TARGET_HOST"

        NIX_SSHOPTS="-o ForwardAgent=yes" \
        ${pkgs.nixos-rebuild}/bin/nixos-rebuild switch \
          --fast --flake ".#$TARGET_HOST" \
          --use-remote-sudo \
          --target-host "mbk@$TARGET_HOST" \
          --build-host "mbk@$BUILD_HOST"
      '';
      packages.ponyfetch = pkgs.writeShellApplication {
        name = "ponyfetch";
        runtimeInputs = [
          pkgs.fastfetch
          pkgs.ponysay
        ];
        text = ''
          if [[ $# -eq 1 ]]; then
            ssh "mbk@$1" nix run nixpkgs#fastfetch -- --pipe false | ponysay -b round -W 120 -f "$1"
          else
            fastfetch --pipe false | ponysay -b round -W 120 -f "$(hostname)"
          fi
        '';
      };
    };
  };
}
