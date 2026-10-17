export type SessionImage = {
  canvas: HTMLCanvasElement;
  data: ImageData;
  width: number;
  height: number;
};

let session: SessionImage | null = null;
let generation = 0;

export function nextGeneration() {
  generation += 1;
  return generation;
}

export function currentGeneration() {
  return generation;
}

export function getSession() {
  return session;
}

export function setSession(next: SessionImage | null) {
  session = next;
}
