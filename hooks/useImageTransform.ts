import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type { Transform } from '../types';

interface Bounds {
  width: number;
  height: number;
}

interface UseImageTransformProps {
  imageBounds?: Bounds;
  frameBounds?: Bounds;
  rotationGestureEnabled?: boolean;
}

const MAX_ZOOM = 5;

const normalizeAngle = (angle: number): number => {
  let newAngle = angle % 360;
  if (newAngle > 180) newAngle -= 360;
  else if (newAngle <= -180) newAngle += 360;
  return newAngle;
};

export const useImageTransform = (props: UseImageTransformProps) => {
  const { imageBounds, frameBounds, rotationGestureEnabled = true } = props;
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false });
  
  const isInteracting = useRef(false);
  const interactionState = useRef({
    lastPanPosition: { x: 0, y: 0 },
    lastTouchDist: 0,
    lastTouchAngle: 0,
    pivot: { x: 0, y: 0 }, // Pivot in container's coordinate system
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const clampTransform = useCallback((t: Transform): Transform => {
    if (!imageBounds || !frameBounds) return t;

    const angleRad = t.rotation * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const rotatedImgWidth = Math.abs(imageBounds.width * cos) + Math.abs(imageBounds.height * sin);
    const rotatedImgHeight = Math.abs(imageBounds.width * sin) + Math.abs(imageBounds.height * cos);

    const minScaleToCoverX = frameBounds.width / rotatedImgWidth;
    const minScaleToCoverY = frameBounds.height / rotatedImgHeight;
    const minScale = Math.max(minScaleToCoverX, minScaleToCoverY);
    
    const uncappedScale = t.scale;
    let clampedScale = Math.max(minScale, Math.min(uncappedScale, MAX_ZOOM));

    let { x, y } = t;

    if (clampedScale !== uncappedScale) {
        const pivot = interactionState.current.pivot;
        const scaleRatio = clampedScale / uncappedScale;
        x = pivot.x + (t.x - pivot.x) * scaleRatio;
        y = pivot.y + (t.y - pivot.y) * scaleRatio;
    }

    const imgDisplayWidth = imageBounds.width * clampedScale;
    const imgDisplayHeight = imageBounds.height * clampedScale;

    const rotatedWidth = Math.abs(imgDisplayWidth * cos) + Math.abs(imgDisplayHeight * sin);
    const rotatedHeight = Math.abs(imgDisplayWidth * sin) + Math.abs(imgDisplayHeight * cos);

    const panRangeX = Math.max(0, (rotatedWidth - frameBounds.width) / 2);
    const panRangeY = Math.max(0, (rotatedHeight - frameBounds.height) / 2);

    x = Math.max(-panRangeX, Math.min(x, panRangeX));
    y = Math.max(-panRangeY, Math.min(y, panRangeY));
    
    return { ...t, x, y, scale: clampedScale, rotation: normalizeAngle(t.rotation) };
  }, [imageBounds, frameBounds]);
  

  const resetTransform = useCallback(() => {
    if (!imageBounds || !frameBounds) return;

    const scaleX = frameBounds.width / imageBounds.width;
    const scaleY = frameBounds.height / imageBounds.height;
    const initialScale = Math.max(scaleX, scaleY);

    setTransform(clampTransform({ x: 0, y: 0, scale: initialScale, rotation: 0, flipX: false, flipY: false }));
  }, [imageBounds, frameBounds, clampTransform]);

  const rotateBy = useCallback((degrees: number) => {
    interactionState.current.pivot = { x: 0, y: 0 };
    setTransform(prev => clampTransform({ ...prev, rotation: prev.rotation + degrees }));
  }, [clampTransform]);

  const setRotation = useCallback((degrees: number) => {
    interactionState.current.pivot = { x: 0, y: 0 };
    setTransform(prev => clampTransform({ ...prev, rotation: degrees }));
  }, [clampTransform]);

  const flip = useCallback((axis: 'x' | 'y') => {
      setTransform(prev => clampTransform({ ...prev, flipX: axis === 'x' ? !prev.flipX : prev.flipX, flipY: axis === 'y' ? !prev.flipY : prev.flipY }));
  }, [clampTransform]);

  const onInteractionStart = useCallback((clientX: number, clientY: number) => {
    isInteracting.current = true;
    interactionState.current.lastPanPosition = { x: clientX, y: clientY };
  }, []);

  const onPan = useCallback((clientX: number, clientY: number) => {
    if (!isInteracting.current) return;
    const dx = clientX - interactionState.current.lastPanPosition.x;
    const dy = clientY - interactionState.current.lastPanPosition.y;
    interactionState.current.lastPanPosition = { x: clientX, y: clientY };

    setTransform(prev => {
        const newX = prev.x + dx;
        const newY = prev.y + dy;
        return clampTransform({ ...prev, x: newX, y: newY });
    });
  }, [clampTransform]);
  
  const onInteractionEnd = useCallback(() => {
    isInteracting.current = false;
    setTransform(prev => clampTransform(prev));
  }, [clampTransform]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!containerRef.current) return;
    e.preventDefault();

    setTransform(prev => {
      const rect = containerRef.current!.getBoundingClientRect();
      const zoomFactor = 1 - e.deltaY * 0.001;
      const newScale = prev.scale * zoomFactor;
      
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      interactionState.current.pivot = { x: mouseX, y: mouseY };

      // Zoom towards mouse position
      const newX = mouseX + (prev.x - mouseX) * zoomFactor;
      const newY = mouseY + (prev.y - mouseY) * zoomFactor;

      return clampTransform({ ...prev, scale: newScale, x: newX, y: newY });
    });
  }, [clampTransform]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    isInteracting.current = true;
    if (e.touches.length === 1) {
      interactionState.current.lastPanPosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        interactionState.current.lastTouchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (rotationGestureEnabled) {
          interactionState.current.lastTouchAngle = Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX) * (180 / Math.PI);
        }
        interactionState.current.lastPanPosition = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    }
  }, [rotationGestureEnabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!isInteracting.current || !containerRef.current) return;
    
    setTransform(prev => {
        let newTransform = { ...prev };

        if (e.touches.length === 1) {
            const t = e.touches[0];
            const dx = t.clientX - interactionState.current.lastPanPosition.x;
            const dy = t.clientY - interactionState.current.lastPanPosition.y;
            interactionState.current.lastPanPosition = { x: t.clientX, y: t.clientY };
            
            newTransform.x += dx;
            newTransform.y += dy;

        } else if (e.touches.length === 2) {
            const [t1, t2] = [e.touches[0], e.touches[1]];
            const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const centerPos = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
            
            const scaleFactor = newDist / interactionState.current.lastTouchDist;
            
            let angleDelta = 0;
            if (rotationGestureEnabled) {
                const newAngle = Math.atan2(t1.clientY - t2.clientY, t1.clientX - t2.clientX) * (180 / Math.PI);
                angleDelta = newAngle - interactionState.current.lastTouchAngle;
                interactionState.current.lastTouchAngle = newAngle;
            }

            const panDx = centerPos.x - interactionState.current.lastPanPosition.x;
            const panDy = centerPos.y - interactionState.current.lastPanPosition.y;

            const rect = containerRef.current!.getBoundingClientRect();
            const pivotX = centerPos.x - rect.left - rect.width / 2;
            const pivotY = centerPos.y - rect.top - rect.height / 2;
            
            interactionState.current.pivot = { x: pivotX, y: pivotY };

            // Apply transformations:
            // 1. Scale relative to the touch center
            // 2. Pan
            // 3. Rotate
            const x_after_zoom = pivotX + (prev.x - pivotX) * scaleFactor;
            const y_after_zoom = pivotY + (prev.y - pivotY) * scaleFactor;
            
            newTransform = {
                ...prev,
                scale: prev.scale * scaleFactor,
                rotation: prev.rotation + angleDelta,
                x: x_after_zoom + panDx,
                y: y_after_zoom + panDy,
            };

            interactionState.current.lastTouchDist = newDist;
            interactionState.current.lastPanPosition = centerPos;
        }
        return clampTransform(newTransform);
    });
  }, [clampTransform, rotationGestureEnabled]);

  const imageStyle: React.CSSProperties = useMemo(() => ({
    transform: `translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${transform.scale}) scaleX(${transform.flipX ? -1 : 1}) scaleY(${transform.flipY ? -1 : 1})`,
    transformOrigin: 'center center',
    transition: isInteracting.current ? 'none' : 'transform 0.1s ease-out',
  }), [transform, isInteracting.current]);

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

  return { containerRef, transform, setTransform, clampTransform, imageStyle, containerEventHandlers, resetTransform, rotateBy, setRotation, flip };
};
