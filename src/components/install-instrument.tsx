import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Ribbon } from "@/components/ribbon";
import { isNativeShell } from "@/lib/native-shell";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "mac-safari" | "chromium" | "mac-app" | "other";

function detectPlatform(): Platform {
  if (isNativeShell()) return "mac-app";
  const ua = navigator.userAgent;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || touchMac) return "ios";
  if (/Android/.test(ua)) return "android";
  const chromium = /Chrome|Chromium|Edg\//.test(ua);
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !chromium) return "mac-safari";
  if (chromium) return "chromium";
  return "other";
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Chrome fires this once, early; keep it even if the button mounts later.
let deferredPrompt: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
  });
}

const DIRECTIONS: Record<Exclude<Platform, "ios">, string> = {
  "mac-app":
    "The instrument is already installed upon this Mac. To keep it in the Dock, hold Control, click its mark in the Dock, and choose Options, then Keep in Dock. To carry it to a telephone or tablet, open the Stereo Vue address in Safari or Chrome upon that device and press this same ribbon there.",
  android:
    "Open the menu of your browser (the three points at the upper right) and choose Install app, or Add to Home screen.",
  "mac-safari": "From the File menu of Safari, choose Add to Dock. The instrument shall thereafter open from your Dock.",
  chromium:
    "Look for the small install mark at the right-hand end of the address bar, or open the menu (the three points) and choose Cast, save and share, then Install page as app.",
  other:
    "Your present browser keeps no such apartment for instruments. Pray open Stereo Vue in Safari, Chrome or Edge, and the installation may be made.",
};

export function InstallInstrument({ className }: { className?: string }) {
  const [hidden, setHidden] = useState(true);
  const [directions, setDirections] = useState<string | null>(null);

  useEffect(() => {
    setHidden(isInstalled());
    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (hidden) return null;

  async function install() {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setHidden(true);
      return;
    }
    const platform = detectPlatform();
    if (platform === "ios") {
      window.location.href = "/?install=1&platform=ios";
      return;
    }
    setDirections(DIRECTIONS[platform]);
  }

  return (
    <>
      <Ribbon
        size="lg"
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          void install();
        }}
      >
        Install the Instrument upon Your Device
      </Ribbon>
      {directions ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-parlor/75"
            aria-label="Close the directions"
            onClick={() => setDirections(null)}
          />
          <div className="mount-frame relative z-10 w-full max-w-md bg-[#e8d5a4] p-6 text-[#2a2218] sm:mx-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="kicker !text-[#5c4a32]">Directions for the keeping of</p>
                <h2 className="font-display mt-1 text-2xl italic">Stereo Vue upon Your Device</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#2a2218] hover:bg-[#2a2218]/10 hover:text-[#2a2218]"
                onClick={() => setDirections(null)}
                aria-label="Close"
              >
                <X className="size-5" />
              </Button>
            </div>
            <p className="mt-4 font-display text-base italic leading-relaxed text-[#3a2c1c]">{directions}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
