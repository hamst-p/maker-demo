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
    e.stopPropagation();
    
    const newTouches: TouchData[] = Array.from(e.touches).map(touch => ({
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    }));
    
    // Clear any existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    setTouches(newTouches);

    if (newTouches.length === 1) {
      // Single touch - immediate drag mode (no long press required)
      setIsLongPress(true);
      setDragStart({
        x: newTouches[0].x - bolhatState.x,
        y: newTouches[0].y - bolhatState.y,
      });
    } else if (newTouches.length === 2) {
      // Two-finger touch - start pinch & rotation immediately
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
    e.stopPropagation();
    
    const currentTouches: TouchData[] = Array.from(e.touches).map(touch => ({
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    }));

    if (currentTouches.length === 1 && isLongPress && touches.length === 1) {
      // Direct touch movement - ensure stable tracking
      const currentTouch = currentTouches[0];
      const newX = currentTouch.x - dragStart.x;
      const newY = currentTouch.y - dragStart.y;
      
      onUpdateBolhatState({
        x: newX,
        y: newY,
      });
    } else if (currentTouches.length === 2 && touches.length === 2 && initialDistance > 0) {
      // Two-finger gesture - ensure both touches are tracked
      const currentDistance = getDistance(currentTouches[0], currentTouches[1]);
      const currentAngle = getAngle(currentTouches[0], currentTouches[1]);
      
      // Scaling by pinch with smoothing
      const scaleRatio = currentDistance / initialDistance;
      const newScale = Math.max(0.1, Math.min(10, initialScale * scaleRatio));
      
      // Rotation with improved angle calculation
      let angleDelta = currentAngle - initialAngle;
      
      // Normalize angle difference to prevent jumps
      while (angleDelta > 180) angleDelta -= 360;
      while (angleDelta < -180) angleDelta += 360;
      
      // Calculate new rotation and normalize to 0-360 range
      let newRotation = initialRotation + angleDelta;
      while (newRotation < 0) newRotation += 360;
      while (newRotation >= 360) newRotation -= 360;
      
      onUpdateBolhatState({
        scale: newScale,
        rotation: newRotation,
      });
    }
    
    setTouches(currentTouches);
  }, [isLongPress, dragStart, touches, initialDistance, initialAngle, initialScale, initialRotation, onUpdateBolhatState, getDistance, getAngle]);

  // Touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    const remainingTouches: TouchData[] = Array.from(e.touches).map(touch => ({
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    }));
    
    setTouches(remainingTouches);
    
    // Reset states when all touches end
    if (remainingTouches.length === 0) {
      setIsLongPress(false);
      setInitialDistance(0);
      setInitialAngle(0);
      setInitialScale(1);
      setInitialRotation(0);
    } else if (remainingTouches.length === 1) {
      // Transition from multi-touch to single touch - immediate drag mode
      setIsLongPress(true);
      setInitialDistance(0);
      setDragStart({
        x: remainingTouches[0].x - bolhatState.x,
        y: remainingTouches[0].y - bolhatState.y,
      });
    }
  }, [bolhatState.x, bolhatState.y]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

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
      

    </div>
  );
};

export default DraggableImage; 