import React, { useMemo } from 'react';
import * as THREE from 'three';

interface VectorArrowProps {
    direction: THREE.Vector3;
    color: string;
    opacity?: number;
}

const VectorArrow: React.FC<VectorArrowProps> = ({ direction, color, opacity = 1 }) => {
    const length = direction.length();
    if (length < 0.001) return null;

    // Memoize normalized direction to avoid recalculation
    const normalizedDirection = useMemo(() => direction.clone().normalize(), [direction]);
    
    // Create an ArrowHelper, which is what the deprecated <Arrow> component likely used
    const arrowHelper = useMemo(() => {
        // Use original hardcoded values as a maximum, but scale them down for smaller vectors
        // to prevent the arrow head from being larger than the arrow itself.
        const headLength = Math.min(0.4, length * 0.4);
        const headWidth = Math.min(0.2, length * 0.2);
        
        const helper = new THREE.ArrowHelper(
            normalizedDirection,
            new THREE.Vector3(0, 0, 0),
            length,
            color,
            headLength,
            headWidth
        );

        // Apply opacity
        // @ts-ignore
        if (helper.line.material.transparent !== undefined) {
          // @ts-ignore
          helper.line.material.transparent = opacity < 1;
          // @ts-ignore
          helper.line.material.opacity = opacity;
        }

        // @ts-ignore
        if (helper.cone.material.transparent !== undefined) {
          // @ts-ignore
          helper.cone.material.transparent = opacity < 1;
          // @ts-ignore
          helper.cone.material.opacity = opacity;
        }

        return helper;
    }, [normalizedDirection, length, color, opacity]);

    return (
        <>
            {/* @ts-ignore */}
            <primitive object={arrowHelper} />
        </>
    );
};

export default VectorArrow;