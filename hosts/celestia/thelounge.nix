{ pkgs, ... }:
let
  port = (import ./local-ports.nix).thelounge;
in {
  services.thelounge = {
    enable = true;
    inherit port;

    extraConfig = {
      reverseProxy = true;

      maxHistory = 100000;

      theme = "gruvbox";

      fileUpload = {
        enable = true;
        # only i use this
        maxFileSize = -1;
        baseUrl = "https://irc-static.cattenheimer.xyz/";
      };

      defaults = {
        name = "OFTC";
        host = "irc.oftc.net";
        port = 6697;
        nick = "clj";
        leaveMessage = "something crashed or i changed the config probably";
        join = "#vtluug";
      };
    };
  };
}
