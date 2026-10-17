import { Camera, Images, SwitchCamera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useStereo } from "@/store/stereo";

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const goHome = useStereo((s) => s.goHome);
  const loadBlob = useStereo((s) => s.loadBlob);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    async function start() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);
      } catch {
        if (!cancelled) {
          setError("The camera is not at hand. Use the device’s own, or select a photograph.");
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing]);

  function capture() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) void loadBlob(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <div className="relative min-h-dvh w-full bg-bg text-fg">
      <video
        ref={videoRef}
        className={`absolute inset-0 size-full object-cover ${facing === "user" ? "-scale-x-100" : ""} ${ready ? "opacity-100" : "opacity-0"}`}
        playsInline
        muted
        autoPlay
      />
      <div className="absolute inset-0 bg-bg/40" />

      <div className="safe-x safe-top relative z-10 flex items-center justify-between">
        <Button variant="secondary" size="icon" onClick={goHome} aria-label="Close the camera">
          <X className="size-5" />
        </Button>
        <p className="font-display text-xl italic">The camera</p>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          aria-label="Turn the camera"
          disabled={!ready}
        >
          <SwitchCamera className="size-5" />
        </Button>
      </div>

      <div className="safe-x safe-bottom absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4">
        {error ? (
          <p className="max-w-sm text-center text-sm text-muted">{error}</p>
        ) : (
          <p className="text-xs text-muted">Hold still — the relief is taken from a single instant</p>
        )}
        <div className="flex w-full items-center justify-between gap-4">
          <Button variant="paper" size="icon" onClick={() => fileRef.current?.click()} aria-label="Select a photograph">
            <Images className="size-5" />
          </Button>
          <button
            type="button"
            onClick={() => {
              if (ready) capture();
              else fileRef.current?.click();
            }}
            className="pressable size-20 rounded-full border-4 border-accent bg-paper"
            aria-label="Take the likeness"
          />
          <Button variant="secondary" className="min-w-11" onClick={() => fileRef.current?.click()}>
            <Camera className="size-4" />
            Plate
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void loadBlob(file);
          }}
        />
      </div>
    </div>
  );
}
