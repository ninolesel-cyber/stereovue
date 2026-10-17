import { InstallInstrument } from "@/components/install-instrument";
import { useStereo } from "@/store/stereo";

export function HomeView() {
  const loadBlob = useStereo((s) => s.loadBlob);
  const loadError = useStereo((s) => s.loadError);

  return (
    <div className="home-stack">
      <div className="home-install-bar">
        <InstallInstrument />
      </div>
    <div className="home-plate">
      <img src="/home-plate-top.jpg" alt="Stereo Vue" className="home-plate-top" />
      <div className="home-plate-mid" />
      <img src="/home-plate-bottom.jpg" alt="Est. 2026" className="home-plate-bottom" />
      <input
        type="file"
        accept="image/*"
        aria-label="Take or Upload a Photograph"
        className="home-plate-hit"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void loadBlob(file);
        }}
      />
      {loadError ? (
        <p className="home-plate-error" role="alert">
          {loadError}
        </p>
      ) : null}
    </div>
    </div>
  );
}
