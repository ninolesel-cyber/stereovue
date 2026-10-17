import type { ReactNode } from "react";

export function CardMount({ children, home }: { children: ReactNode; home?: boolean }) {
  if (home) {
    return <div className="parlor parlor-home">{children}</div>;
  }

  return (
    <div className="parlor">
      <div className="stereo-mount">
        <img src="/work-frame-top.jpg" alt="" className="work-frame-top" />
        <div className="work-frame-mid">
          <div className="plate-mid">{children}</div>
        </div>
        <img src="/work-frame-bottom.jpg" alt="" className="work-frame-bottom" />
      </div>
    </div>
  );
}
