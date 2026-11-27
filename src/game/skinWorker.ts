import {
  registerGrayscaleMapField,
  synthesizeSkinBuffer,
  unregisterGrayscaleMapField,
} from './skinField';
import type { SkinDebugStage, SkinPhenotypeSpec, SnakePalette } from './types';

export interface SkinWorkerRenderRequest {
  type?: 'render';
  id: number;
  spec: SkinPhenotypeSpec;
  palette: SnakePalette;
  seed: number;
  width: number;
  height: number;
  debugStage: SkinDebugStage;
}

export interface SkinWorkerRegisterMapMessage {
  type: 'register_map';
  id: string;
  width: number;
  height: number;
  data: Float32Array;
}

export interface SkinWorkerUnregisterMapMessage {
  type: 'unregister_map';
  id: string;
}

export type SkinWorkerRequest = SkinWorkerRenderRequest;
export type SkinWorkerMessage =
  | SkinWorkerRenderRequest
  | SkinWorkerRegisterMapMessage
  | SkinWorkerUnregisterMapMessage;

export interface SkinWorkerResponse {
  id: number;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

self.onmessage = (event: MessageEvent<SkinWorkerMessage>) => {
  const msg = event.data;
  if (msg.type === 'register_map') {
    registerGrayscaleMapField(msg.id, msg.width, msg.height, msg.data);
    return;
  }
  if (msg.type === 'unregister_map') {
    unregisterGrayscaleMapField(msg.id);
    return;
  }
  const { id, spec, palette, seed, width, height, debugStage } = msg;
  const pixels = synthesizeSkinBuffer(spec, palette, seed, width, height, debugStage);
  const response: SkinWorkerResponse = { id, pixels, width, height };
  // Zero-copy transfer of the underlying ArrayBuffer back to the main thread
  (self as unknown as Worker).postMessage(response, [pixels.buffer]);
};
