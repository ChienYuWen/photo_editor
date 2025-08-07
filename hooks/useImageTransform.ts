import React, { useState, useRef, useCallback } from 'react';
import type { Transform } from '../types';

interface Bounds {
  width: number;
  height: number;
}

interface UseImageTransformProps {
  imageBounds?: Bounds;
  frameBounds?: Bounds;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

export const useImageTransform = (props: UseImageTransformProps) => {
  const { imageBounds, frameBounds } = props;
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false });
  
  const isInteracting = useRef(false);
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const touchState = useRef({ lastDist: 0, lastAngle: 0, startTransform: transform });
  const containerRef = useRef<HTMLDivElement>(null);

  const clampTransform = useCallback((t: Transform): Transform => {
    if (!imageBounds || !frameBounds) return t;

    const angleRad = t.rotation * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const absCos = Math.abs(cos);
    const absSin = Math.abs(sin);

    // 1. Calculate minimum scale to cover the frame, accounting for rotation.
    const minScaleToCoverX = (frameBounds.width * absCos + frameBounds.height * absSin) / imageBounds.width;
    const minScaleToCoverY = (frameBounds.width * absSin + frameBounds.height * absCos) / imageBounds.height;
    const minScale = Math.max(minScaleToCoverX, minScaleToCoverY, MIN_ZOOM);
    
    const scaleBeforeClamp = Math.min(t.scale, MAX_ZOOM);
    const clampedScale = Math.max(scaleBeforeClamp, minScale);

    let { x, y } = t;

    // Adjust pan position if scale was auto-adjusted, to keep zoom centered
    if (clampedScale > t.scale && t.scale > 0) {
      const scaleRatio = clampedScale / t.scale;
      x *= scaleRatio;
      y *= scaleRatio;
    }

    // 2. Calculate max panning range in the image's rotated coordinate system
    const panRangeX = Math.max(0, (imageBounds.width * clampedScale - (frameBounds.width * absCos + frameBounds.height * absSin)) / 2);
    const panRangeY = Math.max(0, (imageBounds.height * clampedScale - (frameBounds.width * absSin + frameBounds.height * absCos)) / 2);
    
    // 3. Convert current pan vector to image's coordinate system
    const currentPanXImage = x * cos + y * sin;
    const currentPanYImage = -x * sin + y * cos;

    // 4. Clamp the pan in the image's coordinate system
    const clampedPanXImage = Math.max(-panRangeX, Math.min(currentPanXImage, panRangeX));
    const clampedPanYImage = Math.max(-panRangeY, Math.min(currentPanYImage, panRangeY));

    // 5. Convert clamped pan vector back to viewport coordinates
    const clampedX = clampedPanXImage * cos - clampedPanYImage * sin;
    const clampedY = clampedPanXImage * sin + clampedPanYImage * cos;
    
    return { ...t, x: clampedX, y: clampedY, scale: clampedScale };
  }, [imageBounds, frameBounds]);
  

  const resetTransform = useCallback(() => {
    if (!imageBounds || !frameBounds) return;

    const scaleX = frameBounds.width / imageBounds.width;
    const scaleY = frameBounds.height / imageBounds.height;
    const initialScale = Math.max(scaleX, scaleY);

    setTransform({ x: 0, y: 0, scale: initialScale, rotation: 0, flipX: false, flipY: false });
  }, [imageBounds, frameBounds]);

  const rotateBy = useCallback((degrees: number) => {
    setTransform(prev => clampTransform({ ...prev, rotation: prev.rotation + degrees }));
  }, [clampTransform]);

  const setRotation = useCallback((degrees: number) => {
    setTransform(prev => clampTransform({ ...prev, rotation: degrees }));
  }, [clampTransform]);

  const flip = useCallback((axis: 'x' | 'y') => {
      setTransform(prev => clampTransform({ ...prev, flipX: axis === 'x' ? !prev.flipX : prev.flipX, flipY: axis === 'y' ? !prev.flipY : prev.flipY }));
  }, [clampTransform]);

  const onInteractionStart = useCallback((clientX: number, clientY: number) => {
    isInteracting.current = true;
    lastPanPosition.current = { x: clientX, y: clientY };
  }, []);

  const onPan = useCallback((clientX: number, clientY: number) => {
    if (!isInteracting.current) return;
    const dx = clientX - lastPanPosition.current.x;
    const dy = clientY - lastPanPosition.current.y;
    lastPanPosition.current = { x: clientX, y: clientY };

    setTransform(prev => {
        const newX = prev.x + dx;
        const newY = prev.y + dy;
        return clampTransform({ ...prev, x: newX, y: newY });
    });
  }, [clampTransform]);
  
  const onInteractionEnd = useCallback(() => {
    isInteracting.current = false;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const zoomFactor = 1 - e.deltaY * 0.001;
    
    setTransform(prev => {
        const newScale = prev.scale * zoomFactor;
        
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const newX = prev.x - (mouseX - prev.x) * (newScale / prev.scale - 1);
        const newY = prev.y - (mouseY - prev.y) * (newScale / prev.scale - 1);

        return clampTransform({ ...prev, scale: newScale, x: newX, y: newY });
    });
  }, [clampTransform]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    onInteractionEnd();
    if (e.touches.length === 1) {
        onInteractionStart(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
        isInteracting.current = true;
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        touchState.current = {
            lastDist: Math.hypot(dx, dy),
            lastAngle: Math.atan2(dy, dx) * (180 / Math.PI),
            startTransform: transform,
        };
    }
  }, [onInteractionStart, onInteractionEnd, transform]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isInteracting.current) return;

    if (e.touches.length === 1) {
        onPan(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        const scale = touchState.current.startTransform.scale * (dist / touchState.current.lastDist);
        const rotation = touchState.current.startTransform.rotation + (angle - touchState.current.lastAngle);
        
        setTransform(prev => clampTransform({ ...prev, scale, rotation }));
    }
  }, [onPan, clampTransform]);

  const imageStyle: React.CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${transform.scale}) scaleX(${transform.flipX ? -1 : 1}) scaleY(${transform.flipY ? -1 : 1})`,
    transformOrigin: 'center center',
    transition: isInteracting.current ? 'none' : 'transform 0.1s ease-out',
  };

  const containerEventHandlers = {
    onMouseDown: (e: React.MouseEvent) => onInteractionStart(e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => onPan(e.clientX, e.clientY),
    onMouseUp: onInteractionEnd,
    onMouseLeave: onInteractionEnd,
    onWheel,
    onTouchStart,
    onTouchMove,
    onTouchEnd: onInteractionEnd,
  };

  return { containerRef, transform, imageStyle, containerEventHandlers, resetTransform, rotateBy, setRotation, flip };
};