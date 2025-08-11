import React, { useRef, useCallback, useState } from 'react';
import { UploadCloudIcon, SpinnerIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (imageDataUrl: string) => void;
  isLoading: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (isLoading || !files || files.length === 0) return;
    
    const file = files[0];
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageUpload(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select an image file.');
    }
  };

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isLoading) return;
    setIsDragging(true);
  }, [isLoading]);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    handleFileChange(e.dataTransfer.files);
  }, [onImageUpload, isLoading]);


  return (
    <div className="w-full h-screen flex flex-col justify-center items-center p-4 bg-gray-900 text-gray-400">
      <div
        className={`w-full max-w-lg h-80 border-2 border-dashed rounded-xl flex flex-col justify-center items-center text-center p-8 transition-all duration-300 ${isDragging ? 'border-indigo-500 bg-gray-800' : 'border-gray-600'} ${isLoading ? 'cursor-wait' : 'hover:border-gray-500 hover:bg-gray-800/50 cursor-pointer'}`}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {isLoading ? (
            <>
                <SpinnerIcon className="w-16 h-16 animate-spin text-indigo-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-200">Processing Image...</h2>
                <p className="mt-2 text-sm">Optimizing for the editor.</p>
            </>
        ) : (
            <>
                <UploadCloudIcon className={`w-16 h-16 mb-4 transition-colors ${isDragging ? 'text-indigo-400' : 'text-gray-500'}`} />
                <h2 className="text-xl font-semibold text-gray-200">Click to upload or drag & drop</h2>
                <p className="mt-2 text-sm">PNG, JPG, or GIF</p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files)}
                    disabled={isLoading}
                />
            </>
        )}
      </div>
      <footer className="mt-8 text-center text-gray-500 text-sm">
        <p>Photo Print Editor</p>
        <p>Upload a photo to start editing.</p>
      </footer>
    </div>
  );
};

export default ImageUploader;