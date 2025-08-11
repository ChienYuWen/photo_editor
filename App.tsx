import React, { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import Editor from './components/Editor';

const App: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const downsampleImage = useCallback((imageDataUrl: string): Promise<string> => {
    const MAX_DIMENSION = 2560;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          resolve(imageDataUrl);
          return;
        }

        const aspectRatio = width / height;
        if (width > height) {
          width = MAX_DIMENSION;
          height = width / aspectRatio;
        } else {
          height = MAX_DIMENSION;
          width = height * aspectRatio;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context for downsampling.'));
        }
        
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (err) => reject(new Error('Failed to load image for downsampling: ' + err));
      img.src = imageDataUrl;
    });
  }, []);


  const handleImageUpload = useCallback(async (newImageSrc: string) => {
    setIsLoading(true);
    try {
      const downsampledSrc = await downsampleImage(newImageSrc);
      setImageSrc(downsampledSrc);
    } catch (error) {
      console.error("Failed to process image:", error);
      alert("There was an error processing your image. Please try another one.");
    } finally {
      setIsLoading(false);
    }
  }, [downsampleImage]);

  const handleClearImage = useCallback(() => {
    setImageSrc(null);
  }, []);

  return (
    <main className="w-full min-h-screen bg-gray-900">
      {imageSrc ? (
        <Editor imageSrc={imageSrc} onClearImage={handleClearImage} />
      ) : (
        <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />
      )}
    </main>
  );
};

export default App;