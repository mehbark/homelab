{ ... }:
{
    services.forgejo = {
        enable = true;
        settings = {
            server.ROOT_URL = "https://git.cattenheimer.xyz";
            server.SSH_PORT = 2222;
            service.DISABLE_REGISTRATION = true;
        };
    };
}
