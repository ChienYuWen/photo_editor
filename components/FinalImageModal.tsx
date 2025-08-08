import React from 'react';
import { DownloadIcon, XIcon } from './icons';

interface FinalImageModalProps {
  imageDataUrl: string | null;
  onClose: () => void;
}

const FinalImageModal: React.FC<FinalImageModalProps> = ({ imageDataUrl, onClose }) => {
  if (!imageDataUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full relative animate-fade-in-up">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 z-10 transition-transform hover:scale-110"
        >
          <XIcon className="w-6 h-6" />
        </button>
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4 text-center text-gray-100">Your Edited Photo</h3>
          <div className="bg-gray-900 p-2 rounded-md">
            <img src={imageDataUrl} alt="Final edited" className="w-full h-auto rounded" />
          </div>
          <a
            href={imageDataUrl}
            download="edited-photo.png"
            className="mt-6 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
          >
            <DownloadIcon className="w-5 h-5" />
            Download Image
          </a>
        </div>
      </div>
    </div>
  );
};

export default FinalImageModal;