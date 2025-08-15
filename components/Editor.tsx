import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Filter, Frame, Sticker } from '../types';
import { FILTERS, FRAMES } from '../constants';
import { useImageTransform } from '../hooks/useImageTransform';
import SelectorPanel from './SelectorPanel';
import FinalImageModal from './FinalImageModal';
import { 
  CropIcon, FilterIcon, PencilIcon, StickerIcon, FillIcon, RedactIcon, FrameIcon, ImagePlusIcon, 
  RotateCwIcon, FlipHorizontalIcon, SpinnerIcon, SparklesIcon, Trash2Icon, EyeIcon,
  FlipVerticalIcon
} from './icons';

declare const html2canvas: any;

interface EditorProps {
  imageSrc: string;
  onClearImage: () => void;
}

type Tool = 'crop' | 'rotation' | 'finetune' | 'filter' | 'annotate' | 'sticker' | 'fill' | 'redact' | 'frame';

const Editor: React.FC<EditorProps> = ({ imageSrc, onClearImage }) => {
  const [activeTool, setActiveTool] = useState<Tool>('crop');
  const [activeFilter, setActiveFilter] = useState<Filter>(FILTERS[0]);
  const [activeFrame, setActiveFrame] = useState<Frame>(FRAMES[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [cropAspectRatio, setCropAspectRatio] = useState('3/4');

  const [imageBounds, setImageBounds] = useState<{width: number, height: number}>();
  const [frameBounds, setFrameBounds] = useState<{width: number, height: number}>();
  
  const printFrameRef = useRef<HTMLDivElement>(null);
  const hasBeenInitialized = useRef(false);
  
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
  } = useImageTransform({
    imageBounds, 
    frameBounds,
    rotationGestureEnabled: activeTool !== 'crop',
  });

  useLayoutEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        setImageBounds({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imageSrc]);
  
  // When the image source changes, we need to reset the initialization state
  // so the new image can be properly fitted to the frame.
  useLayoutEffect(() => {
    hasBeenInitialized.current = false;
  }, [imageSrc]);

  useLayoutEffect(() => {
    const updateBounds = () => {
      if (printFrameRef.current) {
        const { clientWidth, clientHeight } = printFrameRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setFrameBounds({ width: clientWidth, height: clientHeight });
        }
      }
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    const mainEl = containerRef.current;
    if (mainEl) {
      observer.observe(mainEl);
    }

    return () => {
      if (mainEl) {
        observer.unobserve(mainEl);
      }
    };
  }, [cropAspectRatio, activeFrame.class, containerRef]);


  // This effect should only run once when the editor is initialized with an image.
  // It waits for both the image's dimensions and the container's dimensions to be known.
  // The `hasBeenInitialized` ref prevents it from re-running on resizes, which would
  // incorrectly reset the user's pan/zoom adjustments.
  useLayoutEffect(() => {
    if (imageBounds && frameBounds && !hasBeenInitialized.current) {
        resetTransform();
        hasBeenInitialized.current = true;
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
  
  const handleSmartEnhance = useCallback(async () => {
    if (!imageSrc || !process.env.API_KEY) {
      alert("Cannot enhance image. Image source or API key is missing.");
      return;
    }

    setIsEnhancing(true);

    try {
      const parts = imageSrc.split(',');
      if (parts.length < 2) throw new Error("Invalid image data URL");
      
      const mimeTypeMatch = parts[0].match(/:(.*?);/);
      if (!mimeTypeMatch) throw new Error("Could not determine mime type from data URL");

      const mimeType = mimeTypeMatch[1];
      const base64Data = parts[1];
      
      const imagePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      };

      const filterList = FILTERS.map(f => f.name).join(', ');
      const textPart = {
        text: `Analyze this photo. Which of these filters would enhance it the most? Your response must be only one of the following words from this list: ${filterList}`,
      };

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
      });
      
      const suggestedFilterName = response.text.trim();
      const suggestedFilter = FILTERS.find(f => f.name.toLowerCase() === suggestedFilterName.toLowerCase());

      if (suggestedFilter) {
        setActiveFilter(suggestedFilter);
        setActiveTool('filter'); 
      } else {
        console.warn(`AI suggested an unknown filter: "${suggestedFilterName}"`);
        alert(`AI could not find a suitable filter. No changes applied.`);
      }

    } catch (error) {
      console.error("Smart Enhance failed:", error);
      alert("Sorry, the Smart Enhance feature encountered an error. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  }, [imageSrc, setActiveFilter, setActiveTool]);


  const handlePrint = useCallback(async () => {
    const printFrame = printFrameRef.current;
    if (!imageBounds || !printFrame) return;
    setIsProcessing(true);

    const outputResolutionMultiplier = 2;

    const contentWidth = printFrame.clientWidth;
    const contentHeight = printFrame.clientHeight;
    const outputContentWidth = contentWidth * outputResolutionMultiplier;
    const outputContentHeight = contentHeight * outputResolutionMultiplier;

    let finalImageContainer: HTMLDivElement | null = null;

    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Failed to load image for rendering.'));
            image.src = imageSrc;
        });

        // Step 1: Create a canvas with the transformed image content (the cropped view)
        const contentCanvas = document.createElement('canvas');
        contentCanvas.width = outputContentWidth;
        contentCanvas.height = outputContentHeight;
        const ctx = contentCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        
        ctx.imageSmoothingQuality = 'high';
        
        // Draw main image with filter
        ctx.save();
        if (activeFilter.style) ctx.filter = activeFilter.style;
        ctx.translate(contentCanvas.width / 2, contentCanvas.height / 2);
        
        const { x, y, scale, rotation, flipX, flipY } = transform;
        const effectiveScale = scale * outputResolutionMultiplier;

        ctx.translate(x * outputResolutionMultiplier, y * outputResolutionMultiplier);
        
        // Apply flip before rotation for intuitive behavior
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.rotate(rotation * (Math.PI / 180));
        ctx.scale(effectiveScale, effectiveScale);
        
        ctx.drawImage(img, -imageBounds.width / 2, -imageBounds.height / 2, imageBounds.width, imageBounds.height);
        ctx.restore();


        // Draw stickers onto the content canvas
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
            const canvasCenterX = contentCanvas.width / 2;
            const canvasCenterY = contentCanvas.height / 2;
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

        const transformedImageSrc = contentCanvas.toDataURL('image/png');

        // Step 2: If there's a frame, create a new container and use html2canvas to add it
        if (activeFrame.class && activeFrame.name !== 'None') {
            finalImageContainer = document.createElement('div');
            finalImageContainer.style.position = 'absolute';
            finalImageContainer.style.left = '-9999px';
            
            // Apply the frame's class and set box-sizing to content-box.
            // This ensures width/height apply to the content area, and the border is drawn outside.
            finalImageContainer.className = activeFrame.class;
            finalImageContainer.style.boxSizing = 'content-box';
            finalImageContainer.style.width = `${outputContentWidth}px`;
            finalImageContainer.style.height = `${outputContentHeight}px`;

            const imageToRender = document.createElement('img');
            imageToRender.style.width = '100%';
            imageToRender.style.height = '100%';
            imageToRender.style.display = 'block';
            imageToRender.src = transformedImageSrc;

            finalImageContainer.appendChild(imageToRender);
            document.body.appendChild(finalImageContainer);

            const finalCanvas = await html2canvas(finalImageContainer, {
                useCORS: true,
                backgroundColor: null,
                logging: false,
                scale: 1, // Already scaled up
            });
            setFinalImage(finalCanvas.toDataURL('image/png'));
        } else {
            // If no frame, the content canvas is the final image.
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
    { id: 'crop', icon: CropIcon, name: 'Crop' },
    { id: 'rotation', icon: RotateCwIcon, name: 'Rotation' },
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
  
  const enabledTools = ['crop', 'rotation', 'filter', 'frame', 'sticker'];
  const showOptionsPanel = ['filter', 'frame', 'sticker'].includes(activeTool);

  return (
    <div className="w-full h-screen bg-gray-900 text-white flex flex-col">
      <FinalImageModal imageDataUrl={finalImage} onClose={() => setFinalImage(null)} />
      
      <header className="w-full bg-gray-800 flex justify-between items-center p-3 shadow-md z-20">
        <div className="flex items-center gap-4">
            <button onClick={onClearImage} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
              <ImagePlusIcon className="w-5 h-5" /> Change Photo
            </button>
            <button
              onClick={handleSmartEnhance}
              disabled={isProcessing || isEnhancing || !imageBounds}
              className="flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Use AI to suggest the best filter for your photo"
            >
              {isEnhancing ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
              {isEnhancing ? 'Analyzing...' : 'Smart Enhance'}
            </button>
            <button
              onMouseDown={() => setIsComparing(true)}
              onMouseUp={() => setIsComparing(false)}
              onMouseLeave={() => setIsComparing(false)}
              onTouchStart={() => setIsComparing(true)}
              onTouchEnd={() => setIsComparing(false)}
              disabled={activeFilter.name === 'None' || isProcessing || isEnhancing}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Press and hold to see the original photo"
            >
              <EyeIcon className="w-5 h-5" />
              Compare
            </button>
        </div>
        <button
          onClick={handlePrint}
          disabled={isProcessing || isEnhancing || !imageBounds}
          className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-300 disabled:cursor-not-allowed text-black font-bold py-2 px-6 rounded-lg transition-colors duration-300"
        >
          {isProcessing ? 'Processing...' : 'Done'}
        </button>
      </header>
      
      <div className="flex-1 relative overflow-hidden">
        <main 
            ref={containerRef} 
            className="w-full h-full relative flex items-center justify-center p-4 overflow-hidden cursor-move touch-none"
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
                    className={`max-w-none select-none flex-shrink-0 transition-all duration-200`}
                    style={{ ...imageStyle, filter: isComparing ? 'none' : activeFilter.style }}
                    draggable="false"
                />
            </div>

            <div
                ref={printFrameRef}
                className={`absolute w-4/5 max-w-full max-h-full pointer-events-none box-content transition-all duration-300 ${activeFrame.class}`}
                style={{ aspectRatio: cropAspectRatio, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)' }}
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
        
        <footer className="absolute bottom-0 left-0 right-0 bg-gray-800/70 backdrop-blur-md shadow-inner z-10 border-t border-gray-700/50">
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
                  const panelTools = ['filter', 'frame', 'sticker'];
                  if (activeTool === tool.id && panelTools.includes(tool.id)) {
                    setActiveTool('crop');
                  } else {
                    setActiveTool(tool.id);
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
           {activeTool === 'rotation' && (
              <div className="p-4 flex justify-center items-center gap-4 border-t border-gray-700/80">
                <button onClick={() => flip('x')} title="Flip Horizontal" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><FlipHorizontalIcon className="w-6 h-6" /></button>
                <button onClick={() => flip('y')} title="Flip Vertical" className="p-2 rounded-full hover:bg-gray-700 transition-colors"><FlipVerticalIcon className="w-6 h-6" /></button>
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