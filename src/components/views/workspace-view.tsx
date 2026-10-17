import { Loader2 } from "lucide-react";
import { Ribbon } from "@/components/ribbon";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useStereo } from "@/store/stereo";

export function WorkspaceView() {
  const goHome = useStereo((s) => s.goHome);
  const sourceUrl = useStereo((s) => s.sourceUrl);
  const photoPreview = useStereo((s) => s.photoPreview);
  const depthPreview = useStereo((s) => s.depthPreview);
  const pane = useStereo((s) => s.pane);
  const setPane = useStereo((s) => s.setPane);
  const depthStatus = useStereo((s) => s.depthStatus);
  const depthKind = useStereo((s) => s.depthKind);
  const modelStatus = useStereo((s) => s.modelStatus);
  const modelProgress = useStereo((s) => s.modelProgress);
  const strength = useStereo((s) => s.strength);
  const setStrength = useStereo((s) => s.setStrength);
  const invertDepth = useStereo((s) => s.invertDepth);
  const toggleInvert = useStereo((s) => s.toggleInvert);
  const generate = useStereo((s) => s.generate);
  const generating = useStereo((s) => s.generating);
  const depthError = useStereo((s) => s.depthError);
  const ready = Boolean(sourceUrl && depthPreview && depthStatus !== "estimating");

  const statusText =
    depthStatus === "estimating"
      ? "Reading the relief…"
      : depthStatus === "enhancing"
        ? modelStatus === "downloading"
          ? `The engine arrives ${Math.round(modelProgress * 100)}%`
          : "The calculating engine refines the relief…"
        : depthKind === "ai"
          ? "Relief is prepared"
          : "A swift estimate of relief";

  return (
    <div className="workspace-grid">
      <header className="wg-head">
        <Ribbon onClick={goHome}>Begin Anew</Ribbon>
      </header>

      <div className="photo-window wg-photo relative">
        <div className="grid h-full min-h-0 place-items-center">
          {sourceUrl ? (
            <img
              src={
                pane === "depth" && depthPreview
                  ? depthPreview
                  : photoPreview || sourceUrl
              }
              alt={pane === "depth" ? "Map of relief" : "The photograph"}
              className="fit-photo"
            />
          ) : (
            <div className="bg-surface-2 h-full w-full animate-pulse" />
          )}
        </div>
        {depthStatus === "estimating" || generating ? (
          <div className="absolute inset-0 grid place-items-center bg-parlor/50">
            <div className="grid justify-items-center gap-2">
              <Loader2 className="size-6 animate-spin text-paper" />
              <p className="font-display text-xs italic text-paper">
                {generating ? "Rendering…" : "Generating the relief…"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="wg-pane">
        <Ribbon
          active={pane === "photo"}
          aria-pressed={pane === "photo"}
          onClick={() => setPane("photo")}
        >
          Photograph
        </Ribbon>
        <Ribbon
          active={pane === "depth"}
          aria-pressed={pane === "depth"}
          disabled={!depthPreview}
          onClick={() => setPane("depth")}
        >
          Relief
        </Ribbon>
      </div>

      <div className="wg-status">
        <p className="text-center font-display text-[0.7rem] italic text-muted">{statusText}</p>
        {depthStatus === "enhancing" && modelStatus === "downloading" ? (
          <div className="bg-surface-2 mt-1 h-1 overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.max(6, Math.round(modelProgress * 100))}%` }}
            />
          </div>
        ) : null}
        {depthError ? (
          <p className="text-danger mt-1 text-xs" role="alert">
            {depthError}
          </p>
        ) : null}
      </div>

      <div className="wg-strength">
        <p className="font-display text-[0.7rem] italic">Relief</p>
        <Slider
          min={0.4}
          max={1.6}
          step={0.05}
          value={[strength]}
          onValueChange={(value) => {
            const next = value[0] ?? 1;
            setStrength(next);
          }}
          aria-label="Strength of relief"
        />
        <button
          type="button"
          onClick={toggleInvert}
          disabled={!depthPreview}
          aria-pressed={invertDepth}
          className={cn(
            "pressable min-h-8 px-1 text-left font-display text-[0.7rem] italic",
            invertDepth ? "text-fg underline decoration-rule/50 underline-offset-4" : "text-muted",
          )}
        >
          Reverse
        </button>
      </div>

      <p className="wg-hint text-center font-display text-[0.7rem] italic text-muted">
        Choose Stereograph or Anaglyph below.
      </p>

      <div className="wg-make relative z-10">
        <Ribbon size="lg" disabled={!ready || generating} onClick={() => void generate("sbs")}>
          Stereograph
        </Ribbon>
        <Ribbon disabled={!ready || generating} onClick={() => void generate("anaglyph")}>
          Anaglyph
        </Ribbon>
        <Ribbon disabled={!ready || generating} onClick={() => void generate("wiggle")}>
          Living plate
        </Ribbon>
      </div>
    </div>
  );
}
