{ self }:
{ ... }:
{
    system.configurationRevision = if (self ? rev) then self.rev else self.dirtyRev;
}
