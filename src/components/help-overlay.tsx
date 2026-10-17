import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStereo } from "@/store/stereo";

export function HelpOverlay() {
  const open = useStereo((s) => s.helpOpen);
  const openHelp = useStereo((s) => s.openHelp);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-parlor/75"
        aria-label="Close the treatise"
        onClick={() => openHelp(false)}
      />
      <div className="mount-frame relative z-10 max-h-[88dvh] w-full max-w-lg overflow-y-auto bg-mount p-6 text-fg sm:mx-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="kicker">A brief treatise</p>
            <h2 className="font-display mt-1 text-3xl italic">Stereo Vue</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={() => openHelp(false)} aria-label="Close">
            <X className="size-5" />
          </Button>
        </div>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-fg/80">
          <section>
            <h3 className="font-medium text-fg">Stereograph</h3>
            <p className="mt-1">
              Two pictures, one for each eye, after Wheatstone's stereoscope of MDCCCXXXII. Turn
              the telephone horizontally; the left-hand picture is for the left eye.
            </p>
          </section>
          <section>
            <h3 className="font-medium text-fg">Anaglyph</h3>
            <p className="mt-1">A red-and-cyan plate. Wear the spectacles with the red glass upon the left eye.</p>
          </section>
          <section>
            <h3 className="font-medium text-fg">Rounded frame</h3>
            <p className="mt-1">
              An optional arch, as on the old parlour cards. When chosen, the saved plate is mounted
              upon cream with rounded windows.
            </p>
          </section>
          <section>
            <h3 className="font-medium text-fg">Preserve to Album</h3>
            <p className="mt-1">
              Upon the telephone, choose the photograph album from the sheet. Upon a writing-desk,
              choose the folder where the plate shall be kept, or dispatch it by letter or message.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
