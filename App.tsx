import React, { useState, useCallback } from 'react';
import ImageUploader from './components/ImageUploader';
import Editor from './components/Editor';

const App: React.FC = () => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  const handleImageUpload = useCallback((newImageSrc: string) => {
    setImageSrc(newImageSrc);
  }, []);

  const handleClearImage = useCallback(() => {
    setImageSrc(null);
  }, []);

  return (
    <main className="w-full min-h-screen bg-gray-900">
      {imageSrc ? (
        <Editor imageSrc={imageSrc} onClearImage={handleClearImage} />
      ) : (
        <ImageUploader onImageUpload={handleImageUpload} />
      )}
    </main>
  );
};

export default App;