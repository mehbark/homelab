{ config, pkgs, ... }:
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
    settings = {
      datadirectory = "/srv/cattenheimer";
      log_type = "file";
      mail_from_address = "noreply";
      mail_domain = "pyrope.net";
      mail_smtphost = "smtp.purelymail.com";
      mail_smtpport = 465;
      mail_smtpsecure = "ssl";
    };
    extraApps = with config.services.nextcloud.package.packages.apps; { 
      inherit registration;
    };
    extraAppsEnable = true;
  };
}
