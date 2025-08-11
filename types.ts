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