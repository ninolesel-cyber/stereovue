import { cn } from "@/lib/utils";

export function StereoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" className="fill-mount" />
      <rect x="1.5" y="1.5" width="29" height="29" fill="none" className="stroke-rule" strokeWidth="1.2" />
      <path d="M6 24 V12 Q6 8 10 8 H13 Q17 8 17 12 V24 Z" className="fill-rule/80" />
      <path d="M19 24 V12 Q19 8 23 8 H26 Q30 8 30 12 V24 Z" className="fill-rule/55" />
    </svg>
  );
}

export function StereoVueLogo({ className }: { className?: string }) {
  return (
    <img
      src="/stereo-vue-logo.jpg"
      alt="Stereo Vue"
      className={cn("w-full rounded-[0.65rem]", className)}
    />
  );
}

export function EngravedRule({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden>
      <span className="h-px flex-1 bg-rule/50" />
      <span className="size-1.5 rotate-45 bg-rule" />
      <span className="h-px flex-1 bg-rule/50" />
    </div>
  );
}

export function TurnGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 88" className={cn("text-rule", className)} aria-hidden>
      <rect x="38" y="8" width="44" height="72" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="44" y="16" width="32" height="48" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M86 44c12 0 22-8 24-20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M106 16l8 10-12 1z" fill="currentColor" />
    </svg>
  );
}

export function ReturnArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 28" className={cn("text-rule", className)} aria-hidden>
      <path d="M18 4 L4 14 L18 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" />
      <path d="M6 14 H44" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
    </svg>
  );
}
