import type { Filter, Frame } from './types';

export const FILTERS: Filter[] = [
  { name: 'None', class: '' },
  { name: 'Grayscale', class: 'grayscale' },
  { name: 'Sepia', class: 'sepia' },
  { name: 'Invert', class: 'invert' },
  { name: 'Vintage', class: 'grayscale sepia-[.6] contrast-[1.1] brightness-[.9]' },
  { name: 'Sunny', class: 'saturate-150 contrast-125' },
  { name: 'Cool', class: 'hue-rotate-[-15deg] saturate-150' },
  { name: 'Dramatic', class: 'contrast-200' },
];

export const FRAMES: Frame[] = [
  { name: 'None', class: '' },
  { name: 'Simple White', class: 'border-[8px] border-white' },
  { name: 'Simple Black', class: 'border-[8px] border-black' },
  { name: 'Elegant', class: 'border-[16px] border-white shadow-lg shadow-black/50' },
  { name: 'Wooden', class: 'border-[16px] border-[#855B32] ring-4 ring-inset ring-[#5A3D20]' },
  { name: 'Polaroid', class: 'border-solid border-gray-100 border-x-[10px] border-t-[10px] border-b-[50px] shadow-md shadow-black/30' },
  { name: 'Thin Line', class: 'border-2 border-white' },
  { name: 'Grunge', class: 'border-[12px] border-double border-gray-500' },
];