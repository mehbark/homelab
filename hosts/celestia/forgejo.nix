{ ... }:
{
    services.forgejo = {
        enable = true;
        settings = {
            server.ROOT_URL = "https://git.cattenheimer.xyz";
            service.DISABLE_REGISTRATION = true;
        };
    };
}
