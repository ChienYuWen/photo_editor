import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import type { Filter, Frame } from '../types';
import { FILTERS, FRAMES } from '../constants';
import { useImageTransform } from '../hooks/useImageTransform';
import SelectorPanel from './SelectorPanel';
import FinalImageModal from './FinalImageModal';
import { 
  TuneIcon, FilterIcon, PencilIcon, StickerIcon, FillIcon, RedactIcon, FrameIcon, ImagePlusIcon, 
  RotateCcwIcon, RotateCwIcon, FlipHorizontalIcon 
} from './icons';

declare const html2canvas: any;

interface EditorProps {
  imageSrc: string;
  onClearImage: () => void;
}

type Tool = 'adjust' | 'finetune' | 'filter' | 'annotate' | 'sticker' | 'fill' | 'redact' | 'frame';

const Editor: React.FC<EditorProps> = ({ imageSrc, onClearImage }) => {
  const [activeTool, setActiveTool] = useState<Tool>('adjust');
  const [activeFilter, setActiveFilter] = useState<Filter>(FILTERS[0]);
  const [activeFrame, setActiveFrame] = useState<Frame>(FRAMES[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalImage, setFinalImage] = useState<string | null>(null);

  const [imageBounds, setImageBounds] = useState<{width: number, height: number}>();
  const [frameBounds, setFrameBounds] = useState<{width: number, height: number}>();
  
  const printFrameRef = useRef<HTMLDivElement>(null);

  const { 
    containerRef, 
    transform, 
    imageStyle, 
    containerEventHandlers, 
    resetTransform, 
    rotateBy, 
    setRotation, 
    flip 
  } = useImageTransform({imageBounds, frameBounds});

  useLayoutEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        setImageBounds({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imageSrc]);

  useLayoutEffect(() => {
    if(printFrameRef.current) {
        const rect = printFrameRef.current.getBoundingClientRect();
        setFrameBounds({ width: rect.width, height: rect.height });
    }
    const observer = new ResizeObserver(() => {
      if(printFrameRef.current) {
        const rect = printFrameRef.current.getBoundingClientRect();
        setFrameBounds({ width: rect.width, height: rect.height });
      }
    });
    if (containerRef.current) {
        observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [containerRef]);

  useLayoutEffect(() => {
    if(imageBounds && frameBounds) {
        resetTransform();
    }
  }, [imageBounds, frameBounds, resetTransform]);


  const handlePrint = useCallback(async () => {
    if (!imageBounds || !frameBounds) return;
    setIsProcessing(true);
    let printContainer: HTMLDivElement | null = null;

    try {
      // Step 1: Pre-render the image with the filter on a separate canvas ("baking" the filter)
      const filteredImageSrc = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!activeFilter.style) {
            resolve(imageSrc); // No filter, use original image
            return;
          }
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Could not get canvas context'));
          }
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.filter = activeFilter.style;
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('Failed to load image for canvas filter baking'));
        img.src = imageSrc;
      });

      // Step 2: Use the pre-filtered image with html2canvas for transforms & frames
      printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.left = '-9999px';
      printContainer.style.width = `${frameBounds.width}px`;
      printContainer.style.height = `${frameBounds.height}px`;
      printContainer.style.overflow = 'hidden';
      printContainer.className = activeFrame.class;
      
      const imageContainer = document.createElement('div');
      imageContainer.style.width = '100%';
      imageContainer.style.height = '100%';
      imageContainer.style.position = 'absolute';
      imageContainer.style.display = 'flex';
      imageContainer.style.alignItems = 'center';
      imageContainer.style.justifyContent = 'center';
      
      const imageToRender = document.createElement('div');
      imageToRender.style.width = `${imageBounds.width}px`;
      imageToRender.style.height = `${imageBounds.height}px`;
      imageToRender.style.flexShrink = '0';
      imageToRender.style.backgroundImage = `url(${filteredImageSrc})`;
      imageToRender.style.backgroundSize = 'contain';
      imageToRender.style.backgroundRepeat = 'no-repeat';
      imageToRender.style.backgroundPosition = 'center';
      imageToRender.style.transformOrigin = 'center center';
      
      const { x, y, scale, rotation, flipX, flipY } = transform;
      // Add translateZ(0) to promote to a compositing layer for better transform rendering
      imageToRender.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale}) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1}) translateZ(0px)`;

      imageContainer.appendChild(imageToRender);
      printContainer.appendChild(imageContainer);
      document.body.appendChild(printContainer);

      const finalCanvas = await html2canvas(printContainer, {
          useCORS: true,
          backgroundColor: null,
          logging: false,
      });
      setFinalImage(finalCanvas.toDataURL('image/png'));

    } catch (err) {
        console.error("Oops, something went wrong!", err);
    } finally {
        if (printContainer) {
            document.body.removeChild(printContainer);
        }
        setIsProcessing(false);
    }
  }, [activeFilter.style, activeFrame.class, imageSrc, transform, imageBounds, frameBounds]);

  const TOOLS = [
    { id: 'adjust', icon: TuneIcon, name: 'Adjust' },
    { id: 'filter', icon: FilterIcon, name: 'Filter' },
    { id: 'frame', icon: FrameIcon, name: 'Frame' },
    { id: 'annotate', icon: PencilIcon, name: 'Annotate' },
    { id: 'sticker', icon: StickerIcon, name: 'Sticker' },
    { id: 'fill', icon: FillIcon, name: 'Fill' },
    { id: 'redact', icon: RedactIcon, name: 'Redact' },
  ] as const;
  
  const handleRotationSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setRotation(parseFloat(e.target.value));
  };

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      <FinalImageModal imageDataUrl={finalImage} onClose={() => setFinalImage(null)} />
      
      <header className="w-full bg-gray-800 flex justify-between items-center p-3 shadow-md z-20">
        <button onClick={onClearImage} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
          <ImagePlusIcon className="w-5 h-5" /> Change Photo
        </button>
        <button
          onClick={handlePrint}
          disabled={isProcessing || !imageBounds || !frameBounds}
          className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 disabled:cursor-not-allowed text-black font-bold py-2 px-6 rounded-lg transition-colors duration-300"
        >
          {isProcessing ? 'Processing...' : 'Done'}
        </button>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-20 bg-gray-800 flex flex-col items-center p-2 space-y-2">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`w-16 h-16 flex flex-col items-center justify-center rounded-lg transition-colors duration-200 ${activeTool === tool.id ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
              title={tool.name}
              disabled={!['adjust', 'filter', 'frame'].includes(tool.id)}
            >
              <tool.icon className={`w-6 h-6 mb-1 ${!['adjust', 'filter', 'frame'].includes(tool.id) ? 'opacity-50' : ''}`} />
              <span className={`text-xs ${!['adjust', 'filter', 'frame'].includes(tool.id) ? 'opacity-50' : ''}`}>{tool.name}</span>
            </button>
          ))}
        </aside>
        
        <div className="flex-1 flex flex-col overflow-hidden">
            <main ref={containerRef} className="flex-1 flex items-center justify-center p-4 relative overflow-hidden cursor-move touch-none" {...containerEventHandlers}>
                <div className="absolute w-full h-full flex items-center justify-center">
                    <img
                        src={imageSrc}
                        alt="user content"
                        className={`max-w-none select-none pointer-events-none flex-shrink-0`}
                        style={{ ...imageStyle, filter: activeFilter.style }}
                        draggable="false"
                    />
                </div>

                {/* The overlay for dimming, border, and grid lines. This defines the actual crop area. */}
                <div
                    ref={printFrameRef}
                    className={`absolute w-4/5 aspect-[4/3] max-w-full max-h-full pointer-events-none box-content ${activeFrame.class}`}
                    style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }}
                >
                    <div className="absolute inset-0 w-full h-full pointer-events-none border border-white/50" />
                    {/* Rule of Thirds Grid */}
                    <div className="absolute top-0 bottom-0 left-1/3 -translate-x-1/2 w-px bg-black/50 ring-1 ring-white/20" />
                    <div className="absolute top-0 bottom-0 left-2/3 -translate-x-1/2 w-px bg-black/50 ring-1 ring-white/20" />
                    <div className="absolute left-0 right-0 top-1/3 -translate-y-1/2 h-px bg-black/50 ring-1 ring-white/20" />
                    <div className="absolute left-0 right-0 top-2/3 -translate-y-1/2 h-px bg-black/50 ring-1 ring-white/20" />
                </div>
            </main>

            {activeTool === 'adjust' && (
              <div className="bg-gray-800/80 backdrop-blur-sm p-3 flex justify-center items-center gap-4 border-t border-gray-700">
                <button onClick={() => rotateBy(-90)} title="Rotate Left" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><RotateCcwIcon className="w-6 h-6" /></button>
                <button onClick={() => rotateBy(90)} title="Rotate Right" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><RotateCwIcon className="w-6 h-6" /></button>
                <button onClick={() => flip('x')} title="Flip Horizontal" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><FlipHorizontalIcon className="w-6 h-6" /></button>
                <div className="flex items-center gap-2 w-48">
                    <span className="text-sm w-12 text-center">{Math.round(transform.rotation)}°</span>
                    <input 
                      type="range" 
                      min="-180" 
                      max="180" 
                      step="0.5" 
                      value={transform.rotation}
                      onChange={handleRotationSliderChange}
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm" 
                    />
                </div>
              </div>
            )}
        </div>
        
        <aside className={`w-80 bg-gray-800 p-4 transition-transform duration-300 ease-in-out overflow-y-auto ${(activeTool === 'filter' || activeTool === 'frame') ? 'translate-x-0' : 'translate-x-full absolute right-0 top-0 bottom-0 h-full'}`}>
          {activeTool === 'filter' && (
            <SelectorPanel
              title="Filters"
              options={FILTERS}
              selectedOption={activeFilter}
              onSelect={(option) => setActiveFilter(option)}
              renderOption={(option, isSelected) => (
                <div className="text-center">
                  <div className={`w-20 h-20 rounded-lg bg-cover bg-center border-2 ${isSelected ? 'border-indigo-500' : 'border-transparent'} transition-all duration-200`} style={{ backgroundImage: `url(${imageSrc})`, filter: option.style }}>
                  </div>
                  <p className={`mt-1 text-xs ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>{option.name}</p>
                </div>
              )}
            />
          )}
           {activeTool === 'frame' && (
             <SelectorPanel
                title="Frames"
                options={FRAMES}
                selectedOption={activeFrame}
                onSelect={(option) => setActiveFrame(option)}
                renderOption={(option, isSelected) => (
                  <div className="text-center">
                    <div className={`w-20 h-20 flex items-center justify-center rounded-lg border-2 ${isSelected ? 'border-indigo-500' : 'border-transparent'}`}>
                      <div className={`w-16 h-16 rounded-sm ${option.class} transition-all duration-200 bg-gray-500`}></div>
                    </div>
                    <p className={`mt-1 text-xs ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>{option.name}</p>
                  </div>
                )}
            />
          )}
        </aside>
      </div>
    </div>
  );
};

export default Editor;