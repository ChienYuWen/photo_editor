export interface Filter {
  name: string;
  style: string;
}

export interface Frame {
  name:string;
  class: string;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
}

export interface Sticker {
  id: string;
  src: string; // base64 data url
  x: number; // position relative to the frame center
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
}
