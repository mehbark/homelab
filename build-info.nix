{ self }:
{ ... }:
{
    system.nixos.variantName = if (self ? rev) then self.rev else self.dirtyRev;
}
