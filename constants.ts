
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
  { name: 'Simple White', class: 'p-2 bg-white' },
  { name: 'Simple Black', class: 'p-2 bg-black' },
  { name: 'Elegant', class: 'p-4 bg-white shadow-lg shadow-black/50' },
  { name: 'Wooden', class: 'p-4 bg-[#855B32] border-4 border-[#5A3D20]' },
  { name: 'Polaroid', class: 'p-2 pb-12 bg-gray-100 shadow-md shadow-black/30' },
  { name: 'Thin Line', class: 'p-1 bg-transparent border-2 border-white' },
  { name: 'Grunge', class: 'p-3 border-4 border-double border-gray-500' },
];
