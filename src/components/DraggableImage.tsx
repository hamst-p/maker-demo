'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DraggableImageProps } from '../types/collage';

interface TouchData {
  identifier: number;
  x: number;
  y: number;
}

const DraggableImage: React.FC<DraggableImageProps> = ({
  src,
  alt,
  bolhatState,
  onUpdateBolhatState,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touches, setTouches] = useState<TouchData[]>([]);
  const [initialDistance, setInitialDistance] = useState(0);
  const [initialAngle, setInitialAngle] = useState(0);
  const [initialScale, setInitialScale] = useState(1);
  const [initialRotation, setInitialRotation] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate distance between touches
  const getDistance = useCallback((touch1: TouchData, touch2: TouchData) => {
    const dx = touch1.x - touch2.x;
    const dy = touch1.y - touch2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Calculate angle between touches
  const getAngle = useCallback((touch1: TouchData, touch2: TouchData) => {
    return Math.atan2(touch2.y - touch1.y, touch2.x - touch1.x) * 180 / Math.PI;
  }, []);

  // Mouse down (PC)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - bolhatState.x,
      y: e.clientY - bolhatState.y,
    });
  }, [bolhatState.x, bolhatState.y]);

  // Mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    onUpdateBolhatState({
      x: newX,
      y: newY,
    });
  }, [isDragging, dragStart, onUpdateBolhatState]);

  // Mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    const newTouches: TouchData[] = Array.from(e.touches).map(touch => ({
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    }));
    
    setTouches(newTouches);

    if (newTouches.length === 1) {
      // Single touch - start long press detection
      longPressTimerRef.current = setTimeout(() => {
        setIsLongPress(true);
        setDragStart({
          x: newTouches[0].x - bolhatState.x,
          y: newTouches[0].y - bolhatState.y,
        });
      }, 500); // 500ms for long press detection
    } else if (newTouches.length === 2) {
      // Two-finger touch - start pinch & rotation
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      setIsLongPress(false);
      
      const distance = getDistance(newTouches[0], newTouches[1]);
      const angle = getAngle(newTouches[0], newTouches[1]);
      
      setInitialDistance(distance);
      setInitialAngle(angle);
      setInitialScale(bolhatState.scale);
      setInitialRotation(bolhatState.rotation);
    }
  }, [bolhatState.x, bolhatState.y, bolhatState.scale, bolhatState.rotation, getDistance, getAngle]);

  // Touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    const currentTouches: TouchData[] = Array.from(e.touches).map(touch => ({
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    }));

    if (currentTouches.length === 1 && isLongPress) {
      // Move after long press
      const newX = currentTouches[0].x - dragStart.x;
      const newY = currentTouches[0].y - dragStart.y;
      
      onUpdateBolhatState({
        x: newX,
        y: newY,
      });
    } else if (currentTouches.length === 2 && touches.length === 2) {
      // Two-finger gesture
      const currentDistance = getDistance(currentTouches[0], currentTouches[1]);
      const currentAngle = getAngle(currentTouches[0], currentTouches[1]);
      
      // Scaling by pinch
      const scaleRatio = currentDistance / initialDistance;
      const newScale = Math.max(0.1, Math.min(10, initialScale * scaleRatio));
      
      // Rotation
      let angleDelta = currentAngle - initialAngle;
      
      // Normalize angle (range -180 to 180)
      while (angleDelta > 180) angleDelta -= 360;
      while (angleDelta < -180) angleDelta += 360;
      
      const newRotation = (initialRotation + angleDelta) % 360;
      
      onUpdateBolhatState({
        scale: newScale,
        rotation: newRotation,
      });
    }
    
    setTouches(currentTouches);
  }, [isLongPress, dragStart, touches, initialDistance, initialAngle, initialScale, initialRotation, onUpdateBolhatState, getDistance, getAngle]);

  // Touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    const remainingTouches: TouchData[] = Array.from(e.touches).map(touch => ({
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    }));
    
    setTouches(remainingTouches);
    
    if (remainingTouches.length === 0) {
      setIsLongPress(false);
    }
  }, []);

  // Set up event listeners
  useEffect(() => {
    // Mouse events (PC)
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={imageRef}
      className={`absolute cursor-move select-none ${isDragging || isLongPress ? 'z-10' : ''} ${isLongPress ? 'ring-2 ring-blue-400' : ''}`}
      style={{
        left: bolhatState.x,
        top: bolhatState.y,
        transform: `scale(${bolhatState.scale}) rotate(${bolhatState.rotation}deg)`,
        transformOrigin: 'center',
        touchAction: 'none', // Disable default touch behavior
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={src}
        alt={alt}
        className="w-24 h-24 object-contain pointer-events-none"
        draggable={false}
      />
      
      {/* Operation hint */}
      {isLongPress && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          Move Mode
        </div>
      )}
    </div>
  );
};

export default DraggableImage; 