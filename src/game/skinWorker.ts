import { synthesizeSkinBuffer } from './skinField';
import type { SkinDebugStage, SkinPhenotypeSpec, SnakePalette } from './types';

export interface SkinWorkerRequest {
  id: number;
  spec: SkinPhenotypeSpec;
  palette: SnakePalette;
  seed: number;
  width: number;
  height: number;
  debugStage: SkinDebugStage;
}

export interface SkinWorkerResponse {
  id: number;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

self.onmessage = (event: MessageEvent<SkinWorkerRequest>) => {
  const { id, spec, palette, seed, width, height, debugStage } = event.data;
  const pixels = synthesizeSkinBuffer(spec, palette, seed, width, height, debugStage);
  const response: SkinWorkerResponse = { id, pixels, width, height };
  // Zero-copy transfer of the underlying ArrayBuffer back to the main thread
  (self as unknown as Worker).postMessage(response, [pixels.buffer]);
};
