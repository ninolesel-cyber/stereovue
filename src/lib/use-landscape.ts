import { useEffect, useState } from "react";

export type DeviceTurn = 0 | 90 | -90;

function readTurn(): DeviceTurn {
  if (typeof window === "undefined") return 0;

  const landscape =
    window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;
  const angle =
    typeof window.orientation === "number"
      ? window.orientation
      : (screen.orientation?.angle ?? (landscape ? 90 : 0));

  if (angle === 180 || angle === -180) return 0;
  if (angle === 90) return 90;
  if (angle === -90 || angle === 270) return -90;
  if (landscape) return 90;
  return 0;
}

function subscribeTurn(apply: () => void) {
  const mq = window.matchMedia("(orientation: landscape)");
  mq.addEventListener("change", apply);
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  window.visualViewport?.addEventListener("resize", apply);
  screen.orientation?.addEventListener("change", apply);
  return () => {
    mq.removeEventListener("change", apply);
    window.removeEventListener("resize", apply);
    window.removeEventListener("orientationchange", apply);
    window.visualViewport?.removeEventListener("resize", apply);
    screen.orientation?.removeEventListener("change", apply);
  };
}

export function useLandscape() {
  const [landscape, setLandscape] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth > window.innerHeight : false),
  );

  useEffect(() => {
    const apply = () => {
      setLandscape(window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight);
    };
    apply();
    return subscribeTurn(apply);
  }, []);

  return landscape;
}

export function useDeviceTurn() {
  const [turn, setTurn] = useState<DeviceTurn>(() => readTurn());

  useEffect(() => {
    const apply = () => setTurn(readTurn());
    apply();
    const stop = subscribeTurn(apply);
    const onTilt = (event: DeviceOrientationEvent) => {
      const gamma = event.gamma;
      if (gamma == null) return;
      if (window.matchMedia("(orientation: landscape)").matches) {
        apply();
        return;
      }
      if (gamma > 48) setTurn(90);
      else if (gamma < -48) setTurn(-90);
      else if (Math.abs(gamma) < 25) setTurn(0);
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => {
      stop();
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);

  return turn;
}

export async function enableDeviceTilt() {
  try {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === "function") {
      await DOE.requestPermission();
    }
  } catch {
    // iOS may deny; window.orientation still works in Safari.
  }
}

export async function requestLandscapeLock() {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    // Lock is only granted in some installed / fullscreen sessions.
  }
}

export function unlockOrientation() {
  try {
    screen.orientation.unlock?.();
  } catch {
    // ignore
  }
}
