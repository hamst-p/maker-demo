export interface BolhatState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface ImageUploadProps {
  onImageUpload: (imageDataUrl: string) => void;
}

export interface CollageCanvasProps {
  uploadedImage: string | null;
  bolhatState: BolhatState;
  onUpdateBolhatState: (newState: Partial<BolhatState>) => void;
  onImageUpload?: (imageDataUrl: string) => void;
}

export interface DraggableImageProps {
  src: string;
  alt: string;
  bolhatState: BolhatState;
  onUpdateBolhatState: (newState: Partial<BolhatState>) => void;
} 