import { createFileRoute } from "@tanstack/react-router";
import { StereoApp } from "@/components/stereo-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <StereoApp />;
}
