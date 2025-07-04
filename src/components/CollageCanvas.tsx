'use client';

import React, { forwardRef, useState, useRef, useCallback, useEffect } from 'react';
import DraggableImage from './DraggableImage';
import { CollageCanvasProps } from '../types/collage';

const CollageCanvas = forwardRef<HTMLDivElement, CollageCanvasProps>(
  ({ uploadedImage, bolhatState, onUpdateBolhatState, onImageUpload }, ref) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const backgroundImageRef = useRef<HTMLImageElement>(null);
    const bolhatImageRef = useRef<HTMLImageElement>(null);
    const watermarkImageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const rotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const bolhatStateRef = useRef(bolhatState);

    // Store latest bolhatState value in ref
    useEffect(() => {
      bolhatStateRef.current = bolhatState;
    }, [bolhatState]);

    // Wheel event handling for entire canvas (scaling only)
    const handleCanvasWheel = useCallback((e: WheelEvent) => {
      // Enable Bolhat operations only when image is uploaded
      if (!uploadedImage) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // Normal wheel for scaling
      const scaleDelta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.1, Math.min(10, bolhatStateRef.current.scale + scaleDelta));
      onUpdateBolhatState({ scale: newScale });
    }, [uploadedImage, onUpdateBolhatState]);

    // Set up canvas wheel event listener
    useEffect(() => {
      const element = canvasRef.current;
      if (!element) return;

      element.addEventListener('wheel', handleCanvasWheel, { passive: false });

      return () => {
        element.removeEventListener('wheel', handleCanvasWheel);
      };
    }, [handleCanvasWheel]);

    // Start continuous rotation
    const startContinuousRotation = useCallback((direction: 'left' | 'right') => {
      // Clear existing interval if any
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
      }
      
      // Start continuous rotation
      rotationIntervalRef.current = setInterval(() => {
        const currentRotation = bolhatStateRef.current.rotation;
        let newRotation = direction === 'left' ? currentRotation - 1 : currentRotation + 1;
        while (newRotation < 0) newRotation += 360;
        while (newRotation >= 360) newRotation -= 360;
        onUpdateBolhatState({ rotation: newRotation });
      }, 50); // 50ms interval for rotation (20 degrees per second)
    }, [onUpdateBolhatState]);

    // Stop continuous rotation
    const stopContinuousRotation = useCallback(() => {
      if (rotationIntervalRef.current) {
        clearInterval(rotationIntervalRef.current);
        rotationIntervalRef.current = null;
      }
    }, []);

    // Cleanup
    useEffect(() => {
      return () => {
        if (rotationIntervalRef.current) {
          clearInterval(rotationIntervalRef.current);
        }
      };
    }, []);

    const handleSave = async () => {
      if (!uploadedImage || !backgroundImageRef.current || !bolhatImageRef.current || !watermarkImageRef.current) {
        alert('Image loading is not complete.');
        return;
      }

      try {
        const backgroundImg = backgroundImageRef.current;
        const bolhatImg = bolhatImageRef.current;
        
        // Get actual size of canvas element
        const canvasElement = ref && 'current' in ref && ref.current;
        if (!canvasElement) return;
        
        const canvasRect = canvasElement.getBoundingClientRect();
        const canvasDisplayWidth = canvasRect.width;
        const canvasDisplayHeight = canvasRect.height;
        
        // Original image resolution
        const originalWidth = backgroundImg.naturalWidth;
        const originalHeight = backgroundImg.naturalHeight;
        
        // Calculate background image display size (matching object-cover)
        const backgroundAspectRatio = originalWidth / originalHeight;
        const canvasAspectRatio = canvasDisplayWidth / canvasDisplayHeight;
        
        let displayedImageWidth, displayedImageHeight, offsetX, offsetY;
        
        if (backgroundAspectRatio > canvasAspectRatio) {
          // Image is landscape, fit by height (object-cover)
          displayedImageHeight = canvasDisplayHeight;
          displayedImageWidth = canvasDisplayHeight * backgroundAspectRatio;
          offsetX = (displayedImageWidth - canvasDisplayWidth) / 2;
          offsetY = 0;
        } else {
          // Image is portrait, fit by width (object-cover)
          displayedImageWidth = canvasDisplayWidth;
          displayedImageHeight = canvasDisplayWidth / backgroundAspectRatio;
          offsetX = 0;
          offsetY = (displayedImageHeight - canvasDisplayHeight) / 2;
        }
        
        // Calculate scale from display image to original image
        const scaleX = originalWidth / displayedImageWidth;
        const scaleY = originalHeight / displayedImageHeight;
        
        // Create new canvas (same resolution as original image)
        const canvas = document.createElement('canvas');
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Canvas context could not be created');
        }
        
        // Draw background image
        ctx.drawImage(backgroundImg, 0, 0, originalWidth, originalHeight);
        
        // Calculate Bolhat size and position
        const bolhatDisplaySize = 96; // w-24 h-24 = 96px in DraggableImage
        
        // Calculate center point coordinates of Bolhat in display coordinate system
        // bolhatState.x/y are top-left corner coordinates, transformOrigin: center so center point is +48px
        const displayBolhatCenterX = bolhatState.x + bolhatDisplaySize / 2;
        const displayBolhatCenterY = bolhatState.y + bolhatDisplaySize / 2;
        
        // Relative position of Bolhat within display image area (center point)
        // For object-cover, we need to account for the cropped area
        const relativeCenterX = displayBolhatCenterX + offsetX;
        const relativeCenterY = displayBolhatCenterY + offsetY;
        
        // Center point coordinates of Bolhat in original image coordinate system
        const originalCenterX = relativeCenterX * scaleX;
        const originalCenterY = relativeCenterY * scaleY;
        
        // Bolhat size in original image coordinate system
        const originalBolhatSize = bolhatDisplaySize * bolhatState.scale * scaleX;
        
        // Apply rotation and scaling to draw Bolhat
        ctx.save();
        
        // Move to Bolhat center point
        ctx.translate(originalCenterX, originalCenterY);
        
        // Apply rotation
        ctx.rotate((bolhatState.rotation * Math.PI) / 180);
        
        // Draw Bolhat (with center as origin)
        ctx.drawImage(
          bolhatImg,
          -originalBolhatSize / 2,
          -originalBolhatSize / 2,
          originalBolhatSize,
          originalBolhatSize
        );
        
        ctx.restore();

        // Draw watermark in bottom right corner
        const watermarkImg = watermarkImageRef.current;
        const watermarkSize = Math.min(originalWidth, originalHeight) * 0.15; // 15% of the smaller dimension
        const watermarkX = originalWidth - watermarkSize - (originalWidth * 0.02); // 2% margin from right
        const watermarkY = originalHeight - watermarkSize - (originalHeight * 0.02); // 2% margin from bottom
        
        ctx.globalAlpha = 0.3; // 70% transparency
        ctx.drawImage(
          watermarkImg,
          watermarkX,
          watermarkY,
          watermarkSize,
          watermarkSize
        );
        ctx.globalAlpha = 1.0; // Reset opacity
      
        // Save image - mobile-friendly approach
        const imageDataUrl = canvas.toDataURL('image/png', 1.0);
        
        // Detect mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // For mobile: Show image in new window for long-press save
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Save Image</title>
                  <style>
                    body {
                      margin: 0;
                      padding: 20px;
                      background: #f0f0f0;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    }
                    img {
                      max-width: 100%;
                      height: auto;
                      border-radius: 8px;
                      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    }
                    .instructions {
                      margin-top: 20px;
                      text-align: center;
                      color: #666;
                      font-size: 16px;
                      line-height: 1.5;
                    }
                    .close-btn {
                      margin-top: 20px;
                      padding: 12px 24px;
                      background: #007AFF;
                      color: white;
                      border: none;
                      border-radius: 8px;
                      font-size: 16px;
                      cursor: pointer;
                    }
                  </style>
                </head>
                <body>
                  <img src="${imageDataUrl}" alt="Collage Image">
                  <div class="instructions">
                    Long press the image above and select<br>
                    "Save to Photos" or "Add to Photos"
                  </div>
                  <button class="close-btn" onclick="window.close()">Close</button>
                </body>
              </html>
            `);
            newWindow.document.close();
          }
        } else {
          // For desktop: Traditional download
          const link = document.createElement('a');
          link.download = `collage-${Date.now()}.png`;
          link.href = imageDataUrl;
          link.click();
        }
        
      } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save image.');
      }
    };

    const handleFileSelect = (file: File) => {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result && onImageUpload) {
            // Calculate image aspect ratio
            const img = new Image();
            img.onload = () => {
              const aspectRatio = img.width / img.height;
              setImageAspectRatio(aspectRatio);
            };
            img.src = e.target.result as string;
            
            onImageUpload(e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    const handleClick = () => {
      if (!uploadedImage) {
        fileInputRef.current?.click();
      }
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          
          <button
            onClick={handleSave}
            disabled={!uploadedImage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>

        <div
          ref={(element) => {
            canvasRef.current = element;
            if (ref && 'current' in ref) {
              (ref as React.MutableRefObject<HTMLDivElement | null>).current = element;
            }
          }}
          className={`relative mx-auto rounded-lg overflow-hidden transition-colors ${
            uploadedImage 
              ? 'border-2 border-solid border-gray-300 bg-gray-100' 
              : isDragOver 
                ? 'border-2 border-dashed border-blue-500 bg-blue-50' 
                : 'border-2 border-dashed border-gray-300 bg-gray-50 cursor-pointer hover:border-gray-400'
          }`}
          style={{
            width: uploadedImage && imageAspectRatio ? 
              `min(100%, ${imageAspectRatio > 1 ? '80vh' : '60vh'} * ${imageAspectRatio})` : 
              '100%',
            height: uploadedImage && imageAspectRatio ? 
              `min(80vh, 100vw / ${imageAspectRatio})` : 
              '500px',
            aspectRatio: uploadedImage && imageAspectRatio ? `${imageAspectRatio}` : undefined,
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}

        >
          {uploadedImage ? (
            <>
              <img
                ref={backgroundImageRef}
                src={uploadedImage}
                alt="Uploaded image"
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous"
              />
              <DraggableImage
                src="/bolhat.png"
                alt="Bolhat"
                bolhatState={bolhatState}
                onUpdateBolhatState={onUpdateBolhatState}
              />
              
              {/* Mobile scale buttons */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 md:hidden">
                {/* Scale up button */}
                <button
                  onClick={() => {
                    const newScale = Math.min(10, bolhatState.scale + 0.2);
                    onUpdateBolhatState({ scale: newScale });
                  }}
                  className="w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  title="Scale up"
                >
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className="text-gray-700"
                  >
                    <path d="M12 5v14"/>
                    <path d="M5 12h14"/>
                  </svg>
                </button>
                
                {/* Scale down button */}
                <button
                  onClick={() => {
                    const newScale = Math.max(0.1, bolhatState.scale - 0.2);
                    onUpdateBolhatState({ scale: newScale });
                  }}
                  className="w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  title="Scale down"
                >
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className="text-gray-700"
                  >
                    <path d="M5 12h14"/>
                  </svg>
                </button>
              </div>

              {/* Rotation buttons */}
              <div className="absolute top-4 right-4 flex gap-2">
                {/* Counter-clockwise button */}
                <button
                  onClick={() => {
                    let newRotation = bolhatState.rotation - 1;
                    while (newRotation < 0) newRotation += 360;
                    onUpdateBolhatState({ rotation: newRotation });
                  }}
                  onMouseDown={() => startContinuousRotation('left')}
                  onMouseUp={stopContinuousRotation}
                  onMouseLeave={stopContinuousRotation}
                  onTouchStart={() => startContinuousRotation('left')}
                  onTouchEnd={stopContinuousRotation}
                  className="w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  title="Rotate counter-clockwise (Click: 1 degree / Hold: continuous rotation)"
                >
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className="text-gray-700"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="m3 3 2.5 5H11"/>
                  </svg>
                </button>
                
                {/* Clockwise button */}
                <button
                  onClick={() => {
                    let newRotation = bolhatState.rotation + 1;
                    while (newRotation >= 360) newRotation -= 360;
                    onUpdateBolhatState({ rotation: newRotation });
                  }}
                  onMouseDown={() => startContinuousRotation('right')}
                  onMouseUp={stopContinuousRotation}
                  onMouseLeave={stopContinuousRotation}
                  onTouchStart={() => startContinuousRotation('right')}
                  onTouchEnd={stopContinuousRotation}
                  className="w-12 h-12 bg-white/90 hover:bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  title="Rotate clockwise (Click: 1 degree / Hold: continuous rotation)"
                >
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    className="text-gray-700"
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                    <path d="m21 3-2.5 5H13"/>
                  </svg>
                </button>
              </div>
              {/* Watermark in bottom right corner */}
              <img
                src="/bolana.png"
                alt="Watermark"
                className="absolute bottom-2 right-6 w-16 h-16 object-contain opacity-30 pointer-events-none"
                crossOrigin="anonymous"
              />
              
              {/* Hidden Bolhat image for saving */}
              <img
                ref={bolhatImageRef}
                src="/bolhat.png"
                alt="Bolhat for saving"
                className="hidden"
                crossOrigin="anonymous"
              />
              
              {/* Hidden watermark image for saving */}
              <img
                ref={watermarkImageRef}
                src="/bolana.png"
                alt="Watermark for saving"
                className="hidden"
                crossOrigin="anonymous"
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg
                  className="mx-auto h-16 w-16 mb-4 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-lg font-medium mb-2">Upload Image</p>
                <p className="text-sm text-gray-500 mb-1">
                  Drag & drop an image
                </p>
                <p className="text-xs text-gray-400">
                  or click to select a file
                </p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
    );
  }
);

CollageCanvas.displayName = 'CollageCanvas';

export default CollageCanvas; 