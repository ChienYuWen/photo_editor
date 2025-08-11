import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Filter, Frame, Sticker } from '../types';
import { FILTERS, FRAMES } from '../constants';
import { useImageTransform } from '../hooks/useImageTransform';
import SelectorPanel from './SelectorPanel';
import FinalImageModal from './FinalImageModal';
import { 
  TuneIcon, FilterIcon, PencilIcon, StickerIcon, FillIcon, RedactIcon, FrameIcon, ImagePlusIcon, 
  RotateCcwIcon, RotateCwIcon, FlipHorizontalIcon, SpinnerIcon, SparklesIcon, Trash2Icon
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
  
  // Sticker state
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const [stickerPrompt, setStickerPrompt] = useState<string>('A cute cat wearing sunglasses');
  const [isGeneratingStickers, setIsGeneratingStickers] = useState(false);
  const [generatedStickers, setGeneratedStickers] = useState<string[]>([]);
  const [stickerError, setStickerError] = useState<string | null>(null);
  const [draggingSticker, setDraggingSticker] = useState<{id: string, startX: number, startY: number, mouseStartX: number, mouseStartY: number} | null>(null);

  const { 
    containerRef, 
    transform,
    setTransform,
    clampTransform,
    imageStyle, 
    containerEventHandlers: imageTransformHandlers, 
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
  
  useLayoutEffect(() => {
    if (transform && frameBounds) {
        setTransform(prev => clampTransform(prev));
    }
  }, [frameBounds, clampTransform, setTransform]);


  const handleGenerateStickers = useCallback(async () => {
    if (!stickerPrompt || !process.env.API_KEY) {
        setStickerError("Please enter a prompt and ensure your API key is set.");
        return;
    }
    setIsGeneratingStickers(true);
    setStickerError(null);
    setGeneratedStickers([]);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `${stickerPrompt}, sticker, simple, vector art, transparent background`,
            config: {
                numberOfImages: 4,
                outputMimeType: 'image/png',
            },
        });
        
        const imageSrcs = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
        setGeneratedStickers(imageSrcs);

    } catch(e) {
        console.error("Sticker generation failed:", e);
        setStickerError("Sorry, couldn't generate stickers. Please try a different prompt.");
    } finally {
        setIsGeneratingStickers(false);
    }
  }, [stickerPrompt]);
  
  const handleAddSticker = (src: string) => {
    const frameWidth = printFrameRef.current?.clientWidth;
    const stickerSize = frameWidth ? Math.max(80, frameWidth * 0.2) : 120;
    
    const newSticker: Sticker = {
      id: crypto.randomUUID(),
      src,
      x: 0,
      y: 0,
      width: stickerSize,
      height: stickerSize,
      rotation: 0,
      scale: 1,
    };
    setStickers(prev => [...prev, newSticker]);
    setActiveStickerId(newSticker.id);
  };

  const handleDeleteSticker = (id: string) => {
    setStickers(prev => prev.filter(s => s.id !== id));
    setActiveStickerId(null);
  };
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const stickerId = target.dataset.stickerId;

    if (stickerId) {
        e.stopPropagation();
        const sticker = stickers.find(s => s.id === stickerId);
        if (sticker) {
            setActiveStickerId(stickerId);
            setDraggingSticker({
                id: stickerId,
                startX: sticker.x,
                startY: sticker.y,
                mouseStartX: e.clientX,
                mouseStartY: e.clientY
            });
        }
    } else {
        setActiveStickerId(null);
        imageTransformHandlers.onMouseDown(e);
    }
  }, [stickers, imageTransformHandlers]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingSticker && frameBounds) {
        const dx = e.clientX - draggingSticker.mouseStartX;
        const dy = e.clientY - draggingSticker.mouseStartY;
        
        setStickers(prev => prev.map(s => {
            if (s.id !== draggingSticker.id) return s;

            const newPos = { 
                x: draggingSticker.startX + dx,
                y: draggingSticker.startY + dy 
            };
            
            // Clamp position to be within the frame
            const stickerHalfW = s.width * s.scale / 2;
            const stickerHalfH = s.height * s.scale / 2;
            const frameHalfW = frameBounds.width / 2;
            const frameHalfH = frameBounds.height / 2;

            newPos.x = Math.max(-frameHalfW + stickerHalfW, Math.min(newPos.x, frameHalfW - stickerHalfW));
            newPos.y = Math.max(-frameHalfH + stickerHalfH, Math.min(newPos.y, frameHalfH - stickerHalfH));

            return { ...s, x: newPos.x, y: newPos.y };
        }));
    } else {
        imageTransformHandlers.onMouseMove(e);
    }
  }, [draggingSticker, imageTransformHandlers, frameBounds]);

  const handleMouseUp = useCallback(() => {
    setDraggingSticker(null);
    imageTransformHandlers.onMouseUp();
  }, [imageTransformHandlers]);


  const handlePrint = useCallback(async () => {
    const printFrame = printFrameRef.current;
    if (!imageBounds || !printFrame) return;
    setIsProcessing(true);

    const currentFrameBounds = printFrame.getBoundingClientRect();
    const outputResolutionMultiplier = 2;
    const outputWidth = currentFrameBounds.width * outputResolutionMultiplier;
    const outputHeight = currentFrameBounds.height * outputResolutionMultiplier;

    let finalImageContainer: HTMLDivElement | null = null;

    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load image for rendering.'));
            image.src = imageSrc;
        });

        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        
        ctx.imageSmoothingQuality = 'high';
        
        // Draw main image with filter
        ctx.save();
        if (activeFilter.style) ctx.filter = activeFilter.style;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        const { x, y, scale, rotation, flipX, flipY } = transform;
        ctx.translate(x * outputResolutionMultiplier, y * outputResolutionMultiplier);
        ctx.rotate(rotation * (Math.PI / 180));
        ctx.scale(scale, scale);
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(img, -imageBounds.width / 2, -imageBounds.height / 2, imageBounds.width, imageBounds.height);
        ctx.restore();

        // Reset filter and draw stickers
        ctx.filter = 'none';
        const stickerImages = await Promise.all(stickers.map(s => new Promise<HTMLImageElement>((resolve, reject) => {
            const stickerImg = new Image();
            stickerImg.crossOrigin = 'anonymous';
            stickerImg.onload = () => resolve(stickerImg);
            stickerImg.onerror = reject;
            stickerImg.src = s.src;
        })));

        stickers.forEach((sticker, index) => {
            const stickerImg = stickerImages[index];
            const { x, y, width, height, scale, rotation } = sticker;
            const canvasCenterX = canvas.width / 2;
            const canvasCenterY = canvas.height / 2;
            const drawX = canvasCenterX + x * outputResolutionMultiplier;
            const drawY = canvasCenterY + y * outputResolutionMultiplier;
            const drawWidth = width * scale * outputResolutionMultiplier;
            const drawHeight = height * scale * outputResolutionMultiplier;
            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.rotate(rotation * (Math.PI / 180));
            ctx.drawImage(stickerImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.restore();
        });

        const transformedImageSrc = canvas.toDataURL('image/png');

        if (activeFrame.class && activeFrame.name !== 'None') {
            finalImageContainer = document.createElement('div');
            finalImageContainer.style.position = 'absolute';
            finalImageContainer.style.left = '-9999px';
            finalImageContainer.style.width = `${outputWidth}px`;
            finalImageContainer.style.height = `${outputHeight}px`;
            finalImageContainer.style.boxSizing = 'border-box';
            finalImageContainer.className = activeFrame.class;
            
            const imageToRender = document.createElement('img');
            imageToRender.style.width = '100%';
            imageToRender.style.height = '100%';
            imageToRender.style.display = 'block';
            imageToRender.src = transformedImageSrc;

            finalImageContainer.appendChild(imageToRender);
            document.body.appendChild(finalImageContainer);

            const finalCanvas = await html2canvas(finalImageContainer, {
                useCORS: true, backgroundColor: null, logging: false, scale: 1,
            });
            setFinalImage(finalCanvas.toDataURL('image/png'));
        } else {
            setFinalImage(transformedImageSrc);
        }

    } catch (err) {
        console.error("Oops, something went wrong!", err);
        alert('An error occurred while generating the image. Please try again.');
    } finally {
        if (finalImageContainer) document.body.removeChild(finalImageContainer);
        setIsProcessing(false);
    }
  }, [activeFilter.style, activeFrame.class, imageSrc, transform, imageBounds, stickers]);


  const TOOLS = [
    { id: 'adjust', icon: TuneIcon, name: 'Adjust' },
    { id: 'filter', icon: FilterIcon, name: 'Filter' },
    { id: 'frame', icon: FrameIcon, name: 'Frame' },
    { id: 'sticker', icon: StickerIcon, name: 'Sticker' },
    { id: 'annotate', icon: PencilIcon, name: 'Annotate' },
    { id: 'fill', icon: FillIcon, name: 'Fill' },
    { id: 'redact', icon: RedactIcon, name: 'Redact' },
  ] as const;
  
  const handleRotationSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setRotation(parseFloat(e.target.value));
  };
  
  const enabledTools = ['adjust', 'filter', 'frame', 'sticker'];
  const showOptionsPanel = enabledTools.includes(activeTool) && activeTool !== 'adjust';

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      <FinalImageModal imageDataUrl={finalImage} onClose={() => setFinalImage(null)} />
      
      <header className="w-full bg-gray-800 flex justify-between items-center p-3 shadow-md z-20">
        <button onClick={onClearImage} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
          <ImagePlusIcon className="w-5 h-5" /> Change Photo
        </button>
        <button
          onClick={handlePrint}
          disabled={isProcessing || !imageBounds}
          className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 disabled:cursor-not-allowed text-black font-bold py-2 px-6 rounded-lg transition-colors duration-300"
        >
          {isProcessing ? 'Processing...' : 'Done'}
        </button>
      </header>
      
      <div className="flex-1 grid grid-rows-1 grid-cols-1 overflow-hidden">
        <main 
            ref={containerRef} 
            className="row-start-1 col-start-1 flex items-center justify-center p-4 overflow-hidden cursor-move touch-none"
            {...imageTransformHandlers} 
            onMouseDown={handleMouseDown} 
            onMouseMove={handleMouseMove} 
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="absolute w-full h-full flex items-center justify-center pointer-events-none">
                <img
                    src={imageSrc}
                    alt="user content"
                    className={`max-w-none select-none flex-shrink-0`}
                    style={{ ...imageStyle, filter: activeFilter.style }}
                    draggable="false"
                />
            </div>

            <div
                ref={printFrameRef}
                className={`absolute w-4/5 aspect-[4/3] max-w-full max-h-full pointer-events-none box-content ${activeFrame.class}`}
                style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }}
            >
                <div className="absolute inset-0 w-full h-full pointer-events-none border border-white/50" />
                <div className="absolute top-0 bottom-0 left-1/3 -translate-x-1/2 w-px bg-black/50 ring-1 ring-white/20" />
                <div className="absolute top-0 bottom-0 left-2/3 -translate-x-1/2 w-px bg-black/50 ring-1 ring-white/20" />
                <div className="absolute left-0 right-0 top-1/3 -translate-y-1/2 h-px bg-black/50 ring-1 ring-white/20" />
                <div className="absolute left-0 right-0 top-2/3 -translate-y-1/2 h-px bg-black/50 ring-1 ring-white/20" />
                
                {/* Render Stickers */}
                {frameBounds && stickers.map(sticker => (
                  <div
                    key={sticker.id}
                    data-sticker-id={sticker.id}
                    className={`absolute select-none ${activeStickerId === sticker.id ? 'border-2 border-dashed border-blue-400' : ''} cursor-grab`}
                    style={{
                      width: `${sticker.width * sticker.scale}px`,
                      height: `${sticker.height * sticker.scale}px`,
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) translate(${sticker.x}px, ${sticker.y}px) rotate(${sticker.rotation}deg)`,
                    }}
                  >
                     <img 
                       src={sticker.src}
                       alt="sticker"
                       draggable="false"
                       data-sticker-id={sticker.id}
                       className="w-full h-full pointer-events-auto"
                     />
                     {activeStickerId === sticker.id && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleDeleteSticker(sticker.id); }}
                         className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 z-10 transition-transform hover:scale-110"
                         aria-label="Delete sticker"
                        >
                         <Trash2Icon className="w-4 h-4" />
                       </button>
                     )}
                  </div>
                ))}
            </div>
        </main>
        
        <footer className="row-start-1 col-start-1 self-end w-full bg-gray-800 shadow-inner z-10 border-t border-gray-700">
          <div className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${showOptionsPanel ? 'max-h-60' : 'max-h-0'}`}>
            <div className="w-full border-b border-gray-700/80">
              {activeTool === 'filter' && (
                <div className="p-4">
                  <SelectorPanel
                    title="Filters" options={FILTERS} selectedOption={activeFilter} onSelect={(option) => setActiveFilter(option)}
                    renderOption={(option, isSelected) => (
                      <div className="text-center">
                        <div className={`w-20 h-20 rounded-lg bg-cover bg-center border-2 ${isSelected ? 'border-indigo-500' : 'border-transparent'} transition-all duration-200`} style={{ backgroundImage: `url(${imageSrc})`, filter: option.style }}>
                        </div>
                        <p className={`mt-1 text-xs ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>{option.name}</p>
                      </div>
                    )}
                  />
                </div>
              )}
              {activeTool === 'frame' && (
                <div className="p-4">
                  <SelectorPanel
                    title="Frames" options={FRAMES} selectedOption={activeFrame} onSelect={(option) => setActiveFrame(option)}
                    renderOption={(option, isSelected) => (
                      <div className="text-center">
                        <div className={`w-20 h-20 flex items-center justify-center rounded-lg border-2 ${isSelected ? 'border-indigo-500' : 'border-transparent'}`}>
                          <div className={`w-16 h-16 rounded-sm ${option.class} transition-all duration-200 bg-gray-500`}></div>
                        </div>
                        <p className={`mt-1 text-xs ${isSelected ? 'text-indigo-400' : 'text-gray-300'}`}>{option.name}</p>
                      </div>
                    )}
                  />
                </div>
              )}
              {activeTool === 'sticker' && (
                <div className="p-4 h-52 flex items-start gap-4">
                  <div className="flex-shrink-0 w-72 h-full flex flex-col space-y-2">
                      <h3 className="text-sm font-bold text-gray-400">AI Sticker Generator</h3>
                      <textarea 
                          value={stickerPrompt}
                          onChange={(e) => setStickerPrompt(e.target.value)}
                          placeholder="e.g., a robot holding a skateboard"
                          className="w-full flex-grow p-2 rounded-md bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm resize-none"
                      />
                      <button 
                          onClick={handleGenerateStickers}
                          disabled={isGeneratingStickers || !stickerPrompt}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                      >
                          {isGeneratingStickers ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                          {isGeneratingStickers ? 'Generating...' : 'Generate Stickers'}
                      </button>
                      {stickerError && <p className="text-xs text-red-400 text-center">{stickerError}</p>}
                  </div>
                  <div className="flex-1 h-full bg-gray-900/50 rounded-lg">
                      <div className="h-full overflow-y-auto scrollbar-thin p-2">
                        {isGeneratingStickers && (
                            <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 animate-pulse">
                                {[...Array(12)].map((_,i) => <div key={i} className="w-full aspect-square bg-gray-700 rounded-md"></div>)}
                            </div>
                        )}
                        {generatedStickers.length > 0 && (
                            <div className="grid grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                {generatedStickers.map((src, i) => (
                                    <div key={i} onClick={() => handleAddSticker(src)} className="w-full aspect-square bg-gray-700/50 rounded-md cursor-pointer hover:ring-2 ring-indigo-400 transition-all overflow-hidden">
                                        <img src={src} alt={`Generated sticker ${i+1}`} className="w-full h-full object-contain" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {!isGeneratingStickers && generatedStickers.length === 0 && (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                                Generated stickers will appear here.
                            </div>
                        )}
                      </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center p-2 space-x-1">
            {TOOLS.map(tool => (
              <button
                key={tool.id}
                onClick={() => {
                  if(activeTool === tool.id) {
                      setActiveTool(enabledTools.includes(tool.id) && tool.id !== 'adjust' ? 'adjust' : tool.id);
                  } else {
                      setActiveTool(tool.id)
                  }
                }}
                className={`w-16 h-16 flex flex-col items-center justify-center rounded-lg transition-colors duration-200 ${activeTool === tool.id ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title={tool.name}
                disabled={!enabledTools.includes(tool.id)}
              >
                <tool.icon className={`w-5 h-5 mb-1 ${!enabledTools.includes(tool.id) ? 'opacity-50' : ''}`} />
                <span className={`text-[11px] font-medium ${!enabledTools.includes(tool.id) ? 'opacity-50' : ''}`}>{tool.name}</span>
              </button>
            ))}
          </div>
           {activeTool === 'adjust' && (
              <div className="p-4 flex justify-center items-center gap-4 border-t border-gray-700/80">
                <button onClick={() => rotateBy(-90)} title="Rotate Left" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><RotateCcwIcon className="w-6 h-6" /></button>
                <button onClick={() => rotateBy(90)} title="Rotate Right" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><RotateCwIcon className="w-6 h-6" /></button>
                <button onClick={() => flip('x')} title="Flip Horizontal" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><FlipHorizontalIcon className="w-6 h-6" /></button>
                <div className="flex items-center gap-2 w-48">
                    <span className="text-sm w-12 text-center">{Math.round(transform.rotation)}°</span>
                    <input 
                      type="range" min="-180" max="180" step="0.5" value={transform.rotation}
                      onChange={handleRotationSliderChange}
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm" 
                    />
                </div>
              </div>
            )}
        </footer>
      </div>
    </div>
  );
};

export default Editor;
