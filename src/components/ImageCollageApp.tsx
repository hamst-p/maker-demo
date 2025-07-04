'use client';

import React, { useState, useRef } from 'react';
import CollageCanvas from './CollageCanvas';
import { BolhatState } from '../types/collage';

const ImageCollageApp: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [bolhatState, setBolhatState] = useState<BolhatState>({
    x: 200, // Near center of canvas (half of 400px width)
    y: 200, // Near center of canvas (half of 400px height)
    scale: 3, // 3x size
    rotation: 0,
  });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (imageDataUrl: string) => {
    setUploadedImage(imageDataUrl);
  };

  const updateBolhatState = (newState: Partial<BolhatState>) => {
    setBolhatState((prev: BolhatState) => ({ ...prev, ...newState }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Bolana Maker
        </h1>
        
        {/* Canvas */}
        <CollageCanvas
          ref={canvasRef}
          uploadedImage={uploadedImage}
          bolhatState={bolhatState}
          onUpdateBolhatState={updateBolhatState}
          onImageUpload={handleImageUpload}
        />
      </div>
    </div>
  );
};

export default ImageCollageApp; 