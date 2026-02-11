{ ... }:
let 
    port = builtins.toString (import ./local-ports.nix).tuwunel;
in
{
    services.matrix-tuwunel = {
        enable = true;

        settings.global = {
            server_name = "cattenheimer.xyz";
            allow_registration = true;
            # TODO: come on man
            registration_token_file = "/srv/tuwunel/token.txt";
            new_user_displayname_suffix = "";
        };
    };

    services.caddy.virtualHosts."cattenheimer.xyz:80".extraConfig = ''
      reverse_proxy :${port}
    '';

    services.caddy.virtualHosts."cattenheimer.xyz:8448".extraConfig = ''
      reverse_proxy :${port}
    '';
}
