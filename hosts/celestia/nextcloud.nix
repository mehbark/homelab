{ pkgs, ... }:
{
    services.nginx.virtualHosts."upload.cattenheimer.xyz".listen = [ { addr = "127.0.0.1"; port = 8080; } ];

    services.nextcloud = {
        enable = true;
        package = pkgs.nextcloud31;
        hostName = "upload.cattenheimer.xyz";
        database.createLocally = true;
        config = {
            dbtype = "pgsql";
            adminpassFile = "/home/mbk/nextcloud-admin-pass";
        };
    };
}
