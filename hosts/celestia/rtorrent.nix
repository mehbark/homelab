{ ... }:
{
  services.rtorrent = {
    enable = true;
    openFirewall = true;
    downloadDir = "/srv/torrent";
    configText = ''
      schedule = watch_directory, 5, 5, "load.start=/srv/torrent/*.torrent"
    '';
  };
}
