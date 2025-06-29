{ pkgs, ... }:
{
  services.weechat = {
    enable = true;
    headless = true;
  };
  environment.systemPackages = [
    pkgs.weechat
  ];
}
