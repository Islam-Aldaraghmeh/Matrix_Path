import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import VectorArrow from './VectorArrow';
import TracedPath from './TracedPath';
import VectorDot from './VectorDot';
import type { Wall, FadingPathStyle } from '../types';

interface SceneObject {
    id: number;
    color: string;
    initialVector: THREE.Vector3;
    finalVector: THREE.Vector3 | null;
    interpolatedVector: THREE.Vector3 | null;
    path: THREE.Vector3[];
    contacts: {
        wallId: number;
        axis: Wall['axis'];
        position: number;
        point: THREE.Vector3;
        normalDirection: 1 | -1;
    }[];
}

interface SceneProps {
   sceneData: SceneObject[];
   walls: Wall[];
   dotMode: boolean;
   fadingPath: boolean;
   fadingPathLength: number;
   fadingPathStyle: FadingPathStyle;
   showStartMarkers: boolean;
   showEndMarkers: boolean;
   dynamicFadingPath: boolean;
}

const Scene: React.FC<SceneProps> = React.memo(({
    sceneData,
    walls,
    dotMode,
    fadingPath,
    fadingPathLength,
    fadingPathStyle,
    showStartMarkers,
    showEndMarkers,
    dynamicFadingPath
}) => {
    const prevSceneDataRef = useRef<SceneProps['sceneData']>(sceneData);
    const prevWallsRef = useRef<Wall[]>(walls);

    useEffect(() => {
        prevSceneDataRef.current = sceneData;
    }, [sceneData]);

    useEffect(() => {
        prevWallsRef.current = walls;
    }, [walls]);

    const memoizedSceneData = useMemo(() => {
        if (prevSceneDataRef.current === sceneData) {
            return prevSceneDataRef.current;
        }
        return sceneData.map(entry => ({
            ...entry,
            path: entry.path.slice()
        }));
    }, [sceneData]);

    const memoizedWalls = useMemo(() => {
        if (prevWallsRef.current === walls) {
            return prevWallsRef.current;
        }
        return walls.map(wall => ({ ...wall }));
    }, [walls]);

    const planeSize = 40;

    const getPlaneTransform = (axis: Wall['axis'], position: number) => {
        switch (axis) {
            case 'x':
                return { position: [position, 0, 0] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] };
            case 'y':
                return { position: [0, position, 0] as [number, number, number], rotation: [Math.PI / 2, 0, 0] as [number, number, number] };
            case 'z':
            default:
                return { position: [0, 0, position] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
        }
    };

    const contactHighlights = memoizedSceneData.flatMap(data =>
        data.contacts.map(contact => ({
            ...contact,
            color: data.color
        }))
    );

    return (
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
            {/* @ts-ignore */}
            <color attach="background" args={['#111827']} />
            {/* @ts-ignore */}
            <ambientLight intensity={0.5} />
            {/* @ts-ignore */}
            <pointLight position={[10, 10, 10]} intensity={1} />
            
            <Grid args={[20, 20]} infiniteGrid fadeDistance={25} fadeStrength={1} />
            {/* @ts-ignore */}
            <axesHelper args={[5]} />

            {memoizedWalls.map(wall => {
                const { position, rotation } = getPlaneTransform(wall.axis, wall.position);
                return (
                    <mesh key={wall.id} position={position} rotation={rotation}>
                        <planeGeometry args={[planeSize, planeSize]} />
                        <meshStandardMaterial
                            color="#0f172a"
                            transparent
                            opacity={0.18}
                            side={THREE.DoubleSide}
                            metalness={0.1}
                            roughness={0.6}
                        />
                    </mesh>
                );
            })}

            {contactHighlights.map(({ wallId, axis, point, color, normalDirection }) => {
                const { rotation } = getPlaneTransform(axis, 0);
                const key = `${wallId}-${point.x.toFixed(3)}-${point.y.toFixed(3)}-${point.z.toFixed(3)}`;
                const offsetDistance = 0.03;
                const offset = {
                    x: axis === 'x' ? offsetDistance * normalDirection : 0,
                    y: axis === 'y' ? offsetDistance * normalDirection : 0,
                    z: axis === 'z' ? offsetDistance * normalDirection : 0,
                };
                return (
                    <group key={key} position={[point.x + offset.x, point.y + offset.y, point.z + offset.z]} rotation={rotation}>
                        {/* @ts-ignore */}
                        <pointLight color={color} intensity={0.6} distance={1.5} decay={2.5} position={[0, 0, 0]} />
                        <mesh>
                            <circleGeometry args={[0.55, 32]} />
                            <meshBasicMaterial
                                color={color}
                                transparent
                                opacity={0.75}
                                side={THREE.DoubleSide}
                                blending={THREE.AdditiveBlending}
                                polygonOffset
                                polygonOffsetFactor={-1}
                                polygonOffsetUnits={-1}
                                depthWrite={false}
                            />
                        </mesh>
                        <mesh>
                            <circleGeometry args={[0.85, 32]} />
                            <meshBasicMaterial
                                color="#fde68a"
                                transparent
                                opacity={0.25}
                                side={THREE.DoubleSide}
                                blending={THREE.AdditiveBlending}
                                polygonOffset
                                polygonOffsetFactor={-1.5}
                                polygonOffsetUnits={-1.5}
                                depthWrite={false}
                            />
                        </mesh>
                    </group>
                );
            })}

            {memoizedSceneData.map(({ id, color, initialVector, finalVector, interpolatedVector, path }) => (
                <React.Fragment key={id}>
                    {dotMode ? (
                        <>
                            {/* Initial Vector (v) */}
                            {showStartMarkers && <VectorDot position={initialVector} color={color} />}

                            {/* Final Vector (A*v) */}
                            {showEndMarkers && finalVector && <VectorDot position={finalVector} color={color} opacity={0.5} />}
                            
                            {/* Interpolated Vector (A^t*v) */}
                            {interpolatedVector && <VectorDot position={interpolatedVector} color="#fde047" />}
                        </>
                    ) : (
                        <>
                             {/* Initial Vector (v) */}
                            {showStartMarkers && <VectorArrow direction={initialVector} color={color} />}

                            {/* Final Vector (A*v) */}
                            {showEndMarkers && finalVector && <VectorArrow direction={finalVector} color={color} opacity={0.5} />}
                            
                            {/* Interpolated Vector (A^t*v) */}
                            {interpolatedVector && <VectorArrow direction={interpolatedVector} color="#fde047" />}
                        </>
                    )}
                    
                    {/* Traced Path */}
                    <TracedPath
                        points={path}
                        color={color}
                        fading={fadingPath}
                        maxLength={fadingPathLength}
                        style={fadingPathStyle}
                        dynamic={dynamicFadingPath}
                    />
                </React.Fragment>
            ))}

            <OrbitControls />
        </Canvas>
    );
});

Scene.displayName = 'Scene';

export default Scene;
