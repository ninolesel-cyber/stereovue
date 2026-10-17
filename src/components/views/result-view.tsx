import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TurnGlyph, ReturnArrow } from "@/components/stereo-mark";
import { Ribbon } from "@/components/ribbon";
import { canShareFiles, isComputer } from "@/lib/image/io";
import { cn } from "@/lib/utils";
import { enableDeviceTilt, requestLandscapeLock, unlockOrientation, useDeviceTurn, useLandscape } from "@/lib/use-landscape";
import { useStereo, type ResultKind } from "@/store/stereo";

function FrameToggle() {
  const archFrame = useStereo((s) => s.archFrame);
  const toggleArch = useStereo((s) => s.toggleArch);
  const generating = useStereo((s) => s.generating);
  return (
    <button
      type="button"
      onClick={toggleArch}
      disabled={generating}
      className={cn(
        "inline-flex h-9 w-full items-center justify-center border font-display text-sm italic",
        archFrame ? "border-rule bg-surface text-fg" : "border-border text-muted",
      )}
    >
      Rounded frame
    </button>
  );
}

function BrandToggle() {
  const brandStamp = useStereo((s) => s.brandStamp);
  const setBrandStamp = useStereo((s) => s.setBrandStamp);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={brandStamp}
      onClick={() => setBrandStamp(!brandStamp)}
      className={cn(
        "inline-flex h-9 w-full items-center justify-center border font-display text-sm italic",
        brandStamp ? "border-rule bg-surface text-fg" : "border-border text-muted",
      )}
    >
      Made with Stereo Vue
    </button>
  );
}

function BrandCaption({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="pointer-events-none absolute inset-x-2 bottom-[0.35rem] z-10 text-center font-victorian text-[0.48rem] leading-none tracking-[0.14em] text-rule">
      Made with Stereo Vue
    </p>
  );
}

type SaveMode = "auto" | "folder" | "share";

function SaveActions({
  saving,
  generating,
  canSave,
  onSave,
}: {
  saving: boolean;
  generating: boolean;
  canSave: boolean;
  onSave: (mode: SaveMode) => void;
}) {
  const goHome = useStereo((s) => s.goHome);
  const [computer, setComputer] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setComputer(isComputer());
    setCanShare(canShareFiles());
  }, []);
  const disabled = saving || !canSave || generating;
  return (
    <div className="rg-act">
      <FrameToggle />
      <BrandToggle />
      {computer ? (
        <>
          <Ribbon size="lg" disabled={disabled} onClick={() => onSave("folder")}>
            Preserve to a Folder of Your Choosing
          </Ribbon>
          {canShare ? (
            <Ribbon size="lg" disabled={disabled} onClick={() => onSave("share")}>
              Dispatch by Letter or Message
            </Ribbon>
          ) : null}
        </>
      ) : (
        <Ribbon size="lg" disabled={disabled} onClick={() => onSave("auto")}>
          Preserve to Album
        </Ribbon>
      )}
      <Ribbon disabled={generating} onClick={goHome}>
        Begin Anew
      </Ribbon>
    </div>
  );
}

function ResultHeader({ onBack, disabled }: { onBack: () => void; disabled?: boolean }) {
  return (
    <header className="flex w-full items-center justify-between gap-2">
      <button
        type="button"
        onClick={onBack}
        disabled={disabled}
        aria-label="Return to the plate"
        className="pressable inline-flex h-11 min-w-11 items-center justify-start text-rule disabled:opacity-40"
      >
        <ReturnArrow className="h-6 w-11" />
      </button>
      <span className="w-11" />
    </header>
  );
}

function ResultInscription({ kind }: { kind: ResultKind | null }) {
  if (kind === "anaglyph") {
    return (
      <div className="px-1 text-center">
        <p className="font-display text-xl italic text-fg">Behold the Result</p>
        <p className="font-victorian mt-1.5 text-[0.58rem] leading-snug tracking-[0.12em] text-rule">
          — ANAGLYPH, FOR RED & CYAN SPECTACLES —
        </p>
        <p className="mt-2 font-display text-sm italic leading-relaxed text-muted">
          Don a pair of red-and-cyan spectacles, that the illusion of depth may be beheld.
        </p>
      </div>
    );
  }

  if (kind === "sbs") {
    return (
      <div className="px-1 text-center">
        <p className="font-display text-xl italic text-fg">Behold the Result</p>
        <p className="font-victorian mt-1.5 text-[0.58rem] leading-snug tracking-[0.12em] text-rule">
          — STEREOGRAPH, FOR THE PARLOUR VIEWER —
        </p>
        <p className="mt-2 font-display text-sm italic leading-relaxed text-muted">
          Pray, turn your instrument upon its side, and consult your stereo viewer, that the illusion of
          depth may be beheld.
        </p>
      </div>
    );
  }

  return (
    <div className="px-1 text-center">
      <p className="font-display text-xl italic text-fg">Behold the Result</p>
      <p className="font-victorian mt-1.5 text-[0.58rem] leading-snug tracking-[0.12em] text-rule">
        — LIVING PLATE —
      </p>
      <p className="mt-2 font-display text-sm italic leading-relaxed text-muted">
        A short animation of the two eyes, to be looked at without a stereoscope.
      </p>
    </div>
  );
}

export function ResultView() {
  const resultUrl = useStereo((s) => s.resultUrl);
  const leftUrl = useStereo((s) => s.leftUrl);
  const rightUrl = useStereo((s) => s.rightUrl);
  const resultKind = useStereo((s) => s.resultKind);
  const archFrame = useStereo((s) => s.archFrame);
  const generating = useStereo((s) => s.generating);
  const backToWorkspace = useStereo((s) => s.backToWorkspace);
  const saveResult = useStereo((s) => s.saveResult);
  const brandStamp = useStereo((s) => s.brandStamp);
  const [saving, setSaving] = useState(false);
  const landscape = useLandscape();
  const turn = useDeviceTurn();
  const isStereo = resultKind === "sbs";
  const viewportPortrait = !landscape;
  const deviceOnSide = turn !== 0;
  const forceRotate = isStereo && viewportPortrait && deviceOnSide;

  useEffect(() => {
    if (!isStereo) return;
    unlockOrientation();
    void enableDeviceTilt();
    void requestLandscapeLock();
    return () => unlockOrientation();
  }, [isStereo]);

  async function onSave(mode: SaveMode) {
    setSaving(true);
    try {
      const result = await saveResult(mode);
      if (result === "saved") toast.success("The plate is preserved where you directed");
      if (result === "downloaded") toast.success("Preserved to your Downloads");
      if (result === "shared") toast.success(mode === "share" ? "The plate is dispatched" : "Preserve to Album from the sheet");
    } catch {
      toast.error("The plate could not be saved");
    } finally {
      setSaving(false);
    }
  }

  const pair = leftUrl && rightUrl ? (
    <div className="relative min-h-0 flex-1">
      <div className="twin-windows h-full min-h-0">
        <div className={cn("photo-window flex items-center", archFrame && "arch-window")}>
          <img src={leftUrl} alt="Left eye" className="fit-photo" />
        </div>
        <div className={cn("photo-window flex items-center", archFrame && "arch-window")}>
          <img src={rightUrl} alt="Right eye" className="fit-photo" />
        </div>
      </div>
      <BrandCaption show={brandStamp} />
      {generating ? (
        <div className="absolute inset-0 flex items-center justify-center bg-parlor/50">
          <Loader2 className="size-7 animate-spin text-paper" />
        </div>
      ) : null}
    </div>
  ) : null;

  if (forceRotate && leftUrl && rightUrl) {
    return (
      <div className="sbs-force-land" data-turn={String(turn)}>
        <div className="grid grid-cols-[auto_1fr] items-center px-3 py-1">
          <button
            type="button"
            onClick={backToWorkspace}
            aria-label="Return to the plate"
            className="pressable inline-flex h-10 items-center text-rule"
          >
            <ReturnArrow className="h-5 w-10" />
          </button>
        </div>
        {pair}
      </div>
    );
  }

  if (isStereo && landscape && leftUrl && rightUrl) {
    return (
      <div className="result-grid">
        <div className="rg-head">
          <ResultHeader onBack={backToWorkspace} disabled={generating} />
        </div>
        <div className="rg-plate relative">
          <div className="twin-windows h-full min-h-0">
            <div className={cn("photo-window grid h-full place-items-center", archFrame && "arch-window")}>
              <img src={leftUrl} alt="Left eye" className="fit-photo" />
            </div>
            <div className={cn("photo-window grid h-full place-items-center", archFrame && "arch-window")}>
              <img src={rightUrl} alt="Right eye" className="fit-photo" />
            </div>
          </div>
          <BrandCaption show={brandStamp} />
          {generating ? (
            <div className="absolute inset-0 grid place-items-center bg-parlor/50">
              <Loader2 className="size-7 animate-spin text-paper" />
            </div>
          ) : null}
        </div>
        <div className="rg-copy">
          <ResultInscription kind={resultKind} />
        </div>
        <SaveActions saving={saving} generating={generating} canSave onSave={(mode) => void onSave(mode)} />
      </div>
    );
  }

  return (
    <div className="result-grid">
      <div className="rg-head">
        <ResultHeader onBack={backToWorkspace} disabled={generating} />
      </div>

      {isStereo && !archFrame && leftUrl && rightUrl ? (
        <div className="rg-plate relative">
          <div className="twin-windows h-full min-h-0">
            <div className="photo-window grid place-items-center">
              <img src={leftUrl} alt="Left eye" className="fit-photo" />
            </div>
            <div className="photo-window grid place-items-center">
              <img src={rightUrl} alt="Right eye" className="fit-photo" />
            </div>
          </div>
          <BrandCaption show={brandStamp} />
          {generating ? (
            <div className="absolute inset-0 grid place-items-center bg-parlor/50">
              <Loader2 className="size-7 animate-spin text-paper" />
            </div>
          ) : null}
        </div>
      ) : (
        <div className={cn("rg-plate photo-window relative grid place-items-center", archFrame && "arch-window")}>
          {resultUrl ? (
            <img src={resultUrl} alt="" className="fit-photo" />
          ) : null}
          <BrandCaption show={brandStamp} />
          {generating ? (
            <div className="absolute inset-0 grid place-items-center bg-parlor/50">
              <Loader2 className="size-7 animate-spin text-paper" />
            </div>
          ) : null}
        </div>
      )}

      <div className="rg-copy">
        <ResultInscription kind={resultKind} />
        {isStereo && !landscape ? (
          <div className="mt-2 grid place-items-center">
            <TurnGlyph className="w-12 text-rule" />
          </div>
        ) : null}
      </div>

      <SaveActions
        saving={saving}
        generating={generating}
        canSave={Boolean(resultUrl)}
        onSave={(mode) => void onSave(mode)}
      />
    </div>
  );
}
