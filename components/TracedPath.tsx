import React, { useMemo } from 'react';
import { Line, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface TracedPathProps {
    points: THREE.Vector3[];
    color: string;
    fading: boolean;
    maxLength: number;
    style: 'smooth' | 'dots';
}

const DEFAULT_TRAIL_LIMIT = 120;
const BACKGROUND_COLOR = new THREE.Color('#111827');

const clampTrailLength = (length: number | undefined): number => {
    if (!Number.isFinite(length)) return DEFAULT_TRAIL_LIMIT;
    return Math.max(2, Math.floor(length as number));
};

const TracedPath: React.FC<TracedPathProps> = ({ points, color, fading, maxLength, style }) => {
    const baseColor = useMemo(() => new THREE.Color(color), [color]);
    const effectiveLength = useMemo(() => clampTrailLength(maxLength), [maxLength]);

    const trailPoints = useMemo(() => {
        if (!fading) return points;
        const startIndex = Math.max(0, points.length - effectiveLength);
        return points.slice(startIndex);
    }, [points, fading, effectiveLength]);

    const sampledPoints = useMemo(() => {
        if (!fading || style !== 'dots') return trailPoints;
        const interval = Math.max(1, Math.floor(effectiveLength / 24));
        if (interval <= 1) return trailPoints;

        const result: THREE.Vector3[] = [];
        for (let i = 0; i < trailPoints.length; i += interval) {
            result.push(trailPoints[i]);
        }
        if (trailPoints.length > 0 && result[result.length - 1] !== trailPoints[trailPoints.length - 1]) {
            result.push(trailPoints[trailPoints.length - 1]);
        }
        return result;
    }, [trailPoints, fading, style, effectiveLength]);

    const dottedBuffers = useMemo(() => {
        if (!fading || style !== 'dots' || sampledPoints.length === 0) {
            return null;
        }

        const positions = new Float32Array(sampledPoints.length * 3);
        const colors = new Float32Array(sampledPoints.length * 3);

        sampledPoints.forEach((point, idx) => {
            const ratio = sampledPoints.length <= 1 ? 1 : idx / (sampledPoints.length - 1);
            const intensity = Math.pow(ratio, 1.2);
            const tinted = baseColor.clone().lerp(BACKGROUND_COLOR, 1 - intensity);

            const o = idx * 3;
            positions[o] = point.x;
            positions[o + 1] = point.y;
            positions[o + 2] = point.z;

            colors[o] = tinted.r;
            colors[o + 1] = tinted.g;
            colors[o + 2] = tinted.b;
        });

        return { positions, colors };
    }, [fading, style, sampledPoints, baseColor]);

    const lineVertexColors = useMemo(() => {
        if (!fading || style === 'dots' || trailPoints.length < 2) {
            return null;
        }
        return trailPoints.map((_, idx) => {
            const ratio = trailPoints.length <= 1 ? 1 : idx / (trailPoints.length - 1);
            const intensity = Math.pow(ratio, 1.4);
            const tinted = baseColor.clone().lerp(BACKGROUND_COLOR, 1 - intensity);
            const alpha = Math.max(0, Math.min(1, intensity * 0.95 + 0.05));
            return [tinted.r, tinted.g, tinted.b, alpha] as [number, number, number, number];
        });
    }, [fading, style, trailPoints, baseColor]);

    if (trailPoints.length < 2) {
        return null;
    }

    if (!fading) {
        return (
            <Line
                points={trailPoints}
                color={color}
                lineWidth={3}
            />
        );
    }

    if (style === 'dots') {
        if (!dottedBuffers) {
            return null;
        }
        const { positions, colors } = dottedBuffers;

        return (
            <Points positions={positions} colors={colors} stride={3}>
                <PointMaterial
                    transparent
                    vertexColors
                    depthWrite={false}
                    sizeAttenuation
                    size={0.08}
                    opacity={0.95}
                />
            </Points>
        );
    }

    if (!lineVertexColors) {
        return null;
    }

    return (
        <Line
            points={trailPoints}
            vertexColors={lineVertexColors}
            transparent
            depthWrite={false}
            lineWidth={3}
        />
    );
};

export default TracedPath;
