import { useEffect } from "react";
import { Toaster } from "sonner";
import { CardMount } from "@/components/card-mount";
import { HelpOverlay } from "@/components/help-overlay";
import { CameraView } from "@/components/views/camera-view";
import { HomeView } from "@/components/views/home-view";
import { ResultView } from "@/components/views/result-view";
import { WorkspaceView } from "@/components/views/workspace-view";
import { isNativeShell } from "@/lib/native-shell";
import { bootStereo, useStereo } from "@/store/stereo";

export function StereoApp() {
  const view = useStereo((s) => s.view);

  useEffect(() => bootStereo(), []);

  useEffect(() => {
    // Makes the instrument installable as a standalone app and usable offline.
    if ("serviceWorker" in navigator && window.isSecureContext && !isNativeShell()) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (view === "camera") {
    return (
      <>
        <CameraView />
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{ className: "bg-surface text-fg border-border-strong" }}
        />
      </>
    );
  }

  return (
    <CardMount home={view === "home"}>
      {view === "home" ? <HomeView /> : null}
      {view === "workspace" ? <WorkspaceView /> : null}
      {view === "result" ? <ResultView /> : null}
      <HelpOverlay />
      <Toaster
        theme="light"
        position="top-center"
        toastOptions={{ className: "bg-paper text-paper-fg border-rule" }}
      />
    </CardMount>
  );
}
