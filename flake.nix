{
  description = "homelab server flakes";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    puyo-lang.url = "git+https://git.pyrope.net/mbk/puyo-lang.git";
  };

  outputs = inputs @ {
    self,
    nixpkgs,
    flake-parts,
    puyo-lang,
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
            {
              environment.systemPackages = [puyo-lang.packages.x86_64-linux.puyo-lang];
            }
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
        # nix run .#deploy <nixos config name> <server to deploy to> [<server to build on>]
        CONFIG="$1"
        TARGET_HOST="$2"
        BUILD_HOST="''${3:-$TARGET_HOST}"

        echo "building $CONFIG on $BUILD_HOST and deploying to $TARGET_HOST"

        NIX_SSHOPTS="-o ForwardAgent=yes" \
        ${pkgs.nixos-rebuild}/bin/nixos-rebuild switch \
          --fast --flake ".#$CONFIG" \
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
