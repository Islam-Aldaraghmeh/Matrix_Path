import React from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface VectorDotProps {
    position: THREE.Vector3;
    color: string;
    opacity?: number;
}

const VectorDot: React.FC<VectorDotProps> = ({ position, color, opacity = 1 }) => {
    if (position.length() < 0.001) return null;

    return (
        <Sphere args={[0.08, 16, 16]} position={position}>
            {/* @ts-ignore */}
            <meshStandardMaterial 
                color={color} 
                transparent={opacity < 1} 
                opacity={opacity}
                emissive={color}
                emissiveIntensity={0.5}
             />
        </Sphere>
    );
};

export default VectorDot;
