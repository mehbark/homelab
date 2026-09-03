{ comin }:
{ ... }:
{
  services.comin = {
    enable = true;
    remotes = [{
      name = "origin";
      url = "https://github.com/mehbark/homelab.git";
      branches.main.name = "main";
    }];
  };
}
