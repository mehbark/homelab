# `github:mehbark/homelab`
nix stuff for da servers

## deploy

```
nix run .#deploy <host>
```

## bootstrap
bootstrap is hot garbage.
basically, regular nixos install, then set up `mbk` user and tailscale, so that you can nixos-rebuild remotely
