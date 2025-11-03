import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as math from 'mathjs';
import * as THREE from 'three';
import Scene from './components/Scene';
import ControlsPanel from './components/ControlsPanel';
import InfoPanel from './components/InfoPanel';
import { createMatrixEvaluator, multiplyMatrixVector, interpolateEigenvalue } from './utils/mathUtils';
import { easingFunctions } from './utils/easing';
import { activationFunctionMap, parseCustomActivation } from './utils/activationFunctions';
import type { ActivationFunction } from './utils/activationFunctions';
import type { Matrix3, Vector3, VectorObject, Wall, FadingPathStyle } from './types';
import {
    listProfiles,
    loadProfile as loadStoredProfile,
    saveProfile as persistProfile,
    deleteProfile as removeStoredProfile,
    loadLastSession,
    saveLastSession,
    loadLastUsedProfile,
    saveLastUsedProfile,
    getProfileVersion,
    type ProfileData,
    type ProfileSummary,
    type ProfileOperationResult
} from './utils/profileStorage';

// --- CONSTANTS ---

const INITIAL_MATRIX: Matrix3 = [
    [Math.cos(2), -Math.sin(2), 0],
    [Math.sin(2), Math.cos(2), 0],
    [0, 0, 1]
];

export const PRESET_MATRICES: { name: string; matrix: Matrix3 }[] = [
    { name: "Rotation (XY, 2rad)", matrix: INITIAL_MATRIX },
    { name: "Shear", matrix: [[1, 1, 0], [0, 1, 0], [0, 0, 1]] },
    { name: "Scale (Uniform)", matrix: [[1.5, 0, 0], [0, 1.5, 0], [0, 0, 1.5]] },
    { name: "Scale (Non-uniform)", matrix: [[1.5, 0, 0], [0, 0.5, 0], [0, 0, 1]] },
    { name: "Spiral Sink (XY)", matrix: [[1, -1, 0], [1, 1, 0], [0, 0, 0.8]] },
    { name: "Spiral Source (XY)", matrix: [[1, -1, 0], [1, 1, 0], [0, 0, 1.2]] },
    { name: "Saddle Point", matrix: [[1.2, 0, 0], [0, 0.8, 0], [0, 0, 1]] },
    { name: "Custom", matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] }
];


const VECTOR_COLORS = ['#f87171', '#60a5fa', '#facc15', '#4ade80', '#a78bfa', '#fb923c'];

const INITIAL_VECTORS: VectorObject[] = [
    { id: Date.now(), value: [2, 0, 0.5], visible: true, color: VECTOR_COLORS[0] }
];

const PATH_RESOLUTION = 100; // Number of steps per unit of t
const CONTACT_TOLERANCE = 0.07;
type TransformationsMap = Record<number, { initial: THREE.Vector3; final: THREE.Vector3 | null; fullPath: THREE.Vector3[] }>;
interface WallContact {
    wallId: number;
    axis: Wall['axis'];
    position: number;
    point: THREE.Vector3;
    normalDirection: 1 | -1;
}

type Eigenvalue = { re: number; im: number };
type TrailSample = { position: THREE.Vector3; timestamp: number; index: number };

const sanitizeNumber = (value: unknown, fallback: number): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeMatrix3 = (input: unknown, fallback: Matrix3 = INITIAL_MATRIX): Matrix3 => {
    if (!Array.isArray(input)) return fallback;
    const rows: Vector3[] = [];
    for (let i = 0; i < 3; i++) {
        const row = Array.isArray(input[i]) ? input[i] as unknown[] : [];
        rows.push([
            sanitizeNumber(row[0], fallback[i]?.[0] ?? 0),
            sanitizeNumber(row[1], fallback[i]?.[1] ?? 0),
            sanitizeNumber(row[2], fallback[i]?.[2] ?? 0),
        ] as Vector3);
    }
    return rows as Matrix3;
};

const sanitizeVectors = (input: unknown, fallback: VectorObject[] = INITIAL_VECTORS): VectorObject[] => {
    if (!Array.isArray(input)) return fallback;
    const result: VectorObject[] = [];
    let syntheticId = Date.now();
    for (const entry of input) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as Partial<VectorObject>;
        const id = typeof candidate.id === 'number' && Number.isFinite(candidate.id)
            ? candidate.id
            : syntheticId++;
        const valueSource = Array.isArray(candidate.value) ? candidate.value : [];
        const value: Vector3 = [
            sanitizeNumber(valueSource[0], 0),
            sanitizeNumber(valueSource[1], 0),
            sanitizeNumber(valueSource[2], 0),
        ];
        const visible = typeof candidate.visible === 'boolean' ? candidate.visible : true;
        const color = typeof candidate.color === 'string' && candidate.color ? candidate.color : VECTOR_COLORS[id % VECTOR_COLORS.length] ?? '#ffffff';
        result.push({ id, value, visible, color });
    }
    return result.length > 0 ? result : fallback;
};

const sanitizeWalls = (input: unknown): Wall[] => {
    if (!Array.isArray(input)) return [];
    const axes: Wall['axis'][] = ['x', 'y', 'z'];
    const walls: Wall[] = [];
    let syntheticId = Date.now();
    for (const entry of input) {
        if (!entry || typeof entry !== 'object') continue;
        const candidate = entry as Partial<Wall>;
        const axis = typeof candidate.axis === 'string' && axes.includes(candidate.axis as Wall['axis'])
            ? candidate.axis as Wall['axis']
            : null;
        if (!axis) continue;
        const position = sanitizeNumber(candidate.position, 0);
        const id = typeof candidate.id === 'number' && Number.isFinite(candidate.id)
            ? candidate.id
            : syntheticId++;
        walls.push({ id, axis, position });
    }
    return walls;
};

const sanitizeFadingStyle = (value: unknown): FadingPathStyle => {
    return value === 'dots' ? 'dots' : 'smooth';
};

const sanitizeAnimationConfig = (input: unknown): { duration: number; startT: number; endT: number; easing: keyof typeof easingFunctions } => {
    const base = {
        duration: 5,
        startT: 0,
        endT: 2,
        easing: 'easeInOutSine' as keyof typeof easingFunctions
    };
    if (!input || typeof input !== 'object') {
        return base;
    }
    const candidate = input as Partial<{ duration: number; startT: number; endT: number; easing: string }>;
    const duration = Math.max(0.1, sanitizeNumber(candidate.duration, base.duration));
    const startT = sanitizeNumber(candidate.startT, base.startT);
    const endT = sanitizeNumber(candidate.endT, base.endT);
    const easing = typeof candidate.easing === 'string' && candidate.easing in easingFunctions
        ? candidate.easing as keyof typeof easingFunctions
        : base.easing;
    const safeStart = Number.isFinite(startT) ? startT : base.startT;
    const safeEnd = Number.isFinite(endT) ? Math.max(endT, safeStart) : Math.max(base.endT, safeStart);
    return { duration, startT: safeStart, endT: safeEnd, easing };
};

const sanitizeActivation = (input: unknown): { name: string; customFnStr: string } => {
    if (!input || typeof input !== 'object') {
        return { name: 'identity', customFnStr: 'x' };
    }
    const candidate = input as Partial<{ name: string; customFnStr: string }>;
    const name = typeof candidate.name === 'string' && candidate.name.length > 0 ? candidate.name : 'identity';
    const customFnStr = typeof candidate.customFnStr === 'string' ? candidate.customFnStr : 'x';
    return { name, customFnStr };
};

const sanitizeProfileData = (data: ProfileData | null): ProfileData | null => {
    if (!data) return null;
    const animationConfig = sanitizeAnimationConfig(data.animationConfig);
    const activationConfig = sanitizeActivation(data.activation);
    const ensureBoolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
    const preciseT = sanitizeNumber(data.tPrecision, 0.01);
    const safeT = sanitizeNumber(data.t, animationConfig.startT);
    const clampedT = THREE.MathUtils.clamp(safeT, animationConfig.startT, animationConfig.endT);

    return {
        version: data.version ?? 1,
        matrixA: sanitizeMatrix3(data.matrixA),
        vectors: sanitizeVectors(data.vectors),
        walls: sanitizeWalls(data.walls),
        t: clampedT,
        tPrecision: preciseT > 0 ? preciseT : 0.01,
        dotMode: ensureBoolean(data.dotMode, false),
        fadingPath: ensureBoolean(data.fadingPath, false),
        fadingPathLength: Math.max(2, Math.round(sanitizeNumber(data.fadingPathLength, 120))),
        fadingPathStyle: sanitizeFadingStyle(data.fadingPathStyle),
        showStartMarkers: ensureBoolean(data.showStartMarkers, true),
        showEndMarkers: ensureBoolean(data.showEndMarkers, true),
        dynamicFadingPath: ensureBoolean(data.dynamicFadingPath, false),
        animationConfig,
        repeatAnimation: ensureBoolean(data.repeatAnimation, false),
        activation: activationConfig,
        selectedPresetName: typeof data.selectedPresetName === 'string' ? data.selectedPresetName : PRESET_MATRICES[0].name,
        matrixScalar: sanitizeNumber(data.matrixScalar, 1),
        matrixExponent: Math.max(1, Math.round(sanitizeNumber(data.matrixExponent, 1))),
        normalizeMatrix: ensureBoolean(data.normalizeMatrix, false),
        linearEigenInterpolation: ensureBoolean(data.linearEigenInterpolation, false)
    };
};
const mapEigenvalues = (
    raw: (number | math.Complex)[] | math.Matrix | null | undefined
): Eigenvalue[] | null => {
    if (!raw) return null;
    const valuesArray = Array.isArray(raw)
        ? raw
        : typeof (raw as math.Matrix)?.toArray === 'function'
            ? ((raw as math.Matrix).toArray() as (number | math.Complex)[])
            : null;
    if (!valuesArray) return null;

    return valuesArray.map(value => {
        if (typeof value === 'number') {
            return { re: value, im: 0 };
        }
        if (typeof value === 'object' && value !== null && 're' in value && 'im' in value) {
            const complex = value as math.Complex;
            return {
                re: Number.isFinite(complex.re) ? complex.re : NaN,
                im: Number.isFinite(complex.im) ? complex.im : NaN
            };
        }
        const parsed = Number(value);
        return { re: Number.isFinite(parsed) ? parsed : NaN, im: NaN };
    });
};

// --- COMPONENT ---

function App() {
    // Core state
    const [matrixA, setMatrixA] = useState<Matrix3>(INITIAL_MATRIX);
    const [vectors, setVectors] = useState<VectorObject[]>(INITIAL_VECTORS);
    const [walls, setWalls] = useState<Wall[]>([]);
    const [t, setT] = useState<number>(0);
    const [tPrecision, setTPrecision] = useState<number>(0.01);
    const [error, setError] = useState<string | null>(null);
    const [dotMode, setDotMode] = useState<boolean>(false);
    const [fadingPath, setFadingPath] = useState<boolean>(false);
    const [fadingPathLength, setFadingPathLength] = useState<number>(120);
    const [fadingPathStyle, setFadingPathStyle] = useState<FadingPathStyle>('smooth');
    const [showStartMarkers, setShowStartMarkers] = useState<boolean>(true);
    const [showEndMarkers, setShowEndMarkers] = useState<boolean>(true);
    const [dynamicFadingPath, setDynamicFadingPath] = useState<boolean>(false);
    const [selectedPresetName, setSelectedPresetName] = useState(PRESET_MATRICES[0].name);
    const [matrixScalar, setMatrixScalar] = useState<number>(1);
    const [matrixExponent, setMatrixExponent] = useState<number>(1);
    const [normalizeMatrix, setNormalizeMatrix] = useState<boolean>(false);
    const [normalizationWarning, setNormalizationWarning] = useState<string | null>(null);
    const [linearEigenInterpolation, setLinearEigenInterpolation] = useState<boolean>(false);
    const [profileSummaries, setProfileSummaries] = useState<ProfileSummary[]>([]);
    const [activeProfileName, setActiveProfileName] = useState<string | null>(null);

    // Animation state
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [repeatAnimation, setRepeatAnimation] = useState<boolean>(false);
    const [animationConfig, setAnimationConfig] = useState({
        duration: 5, // in seconds
        startT: 0,
        endT: 2,
        easing: 'easeInOutSine' as keyof typeof easingFunctions
    });
    const animationFrameRef = useRef<number | null>(null);
    const animationStartRef = useRef<number | null>(null);
    const animationDirectionRef = useRef<1 | -1>(1);
    const previousTRef = useRef<number>(t);
    const dynamicTrailPointsRef = useRef<Map<number, TrailSample[]>>(new Map());
    const previousSampleIndexRef = useRef<Map<number, number>>(new Map());

    // Activation function state
    const [activation, setActivation] = useState<{
        name: string;
        customFnStr: string;
        currentFn: ActivationFunction;
        error: string | null;
    }>({
        name: 'identity',
        customFnStr: 'x',
        currentFn: activationFunctionMap.identity,
        error: null
    });

    // Effect to parse custom activation function string
    useEffect(() => {
        if (activation.name === 'custom') {
            const { fn, error } = parseCustomActivation(activation.customFnStr);
            setActivation(a => ({ ...a, currentFn: fn || ((x: number) => NaN), error }));
        } else {
            setActivation(a => ({
                ...a,
                currentFn: activationFunctionMap[a.name as keyof typeof activationFunctionMap] || activationFunctionMap.identity,
                error: null
            }));
        }
    }, [activation.name, activation.customFnStr]);


    const stopAnimation = useCallback(() => {
        setIsPlaying(false);
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        animationStartRef.current = null;
        animationDirectionRef.current = 1;
    }, []);

    const resetTime = useCallback(() => {
        stopAnimation();
        setT(animationConfig.startT);
    }, [stopAnimation, animationConfig.startT]);

    useEffect(() => {
        if (!fadingPath || !dynamicFadingPath) {
            dynamicTrailPointsRef.current.clear();
            previousSampleIndexRef.current.clear();
        }
    }, [fadingPath, dynamicFadingPath]);


    // Animation Loop
    useEffect(() => {
        if (!isPlaying) {
            return;
        }

        const animate = (timestamp: number) => {
            if (!animationStartRef.current) {
                animationStartRef.current = timestamp;
            }

            const elapsed = timestamp - animationStartRef.current;
            const progress = Math.min(elapsed / (animationConfig.duration * 1000), 1);
            
            const easingFunc = easingFunctions[animationConfig.easing] || easingFunctions.linear;
            const easedProgress = easingFunc(progress);

            const direction = animationDirectionRef.current;
            const cycleStart = direction === 1 ? animationConfig.startT : animationConfig.endT;
            const cycleEnd = direction === 1 ? animationConfig.endT : animationConfig.startT;

            setT(cycleStart + easedProgress * (cycleEnd - cycleStart));

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setT(cycleEnd);
                if (repeatAnimation) {
                    animationDirectionRef.current = direction === 1 ? -1 : 1;
                    animationStartRef.current = null;
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    stopAnimation();
                }
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, animationConfig, repeatAnimation, stopAnimation]);


    // --- Handlers ---
    const handleMatrixChange = useCallback((newMatrix: Matrix3) => {
        setMatrixA(newMatrix);
        setSelectedPresetName('Custom');
    }, []);

    const handlePresetSelect = useCallback((name: string) => {
        const preset = PRESET_MATRICES.find(p => p.name === name);
        if (preset) {
            setSelectedPresetName(name);
            setMatrixA(preset.matrix);
        }
    }, []);

    const handleAddVector = useCallback(() => {
        setVectors(prev => {
            if (prev.length >= VECTOR_COLORS.length) return prev;
            const newVector: VectorObject = {
                id: Date.now(),
                value: [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2],
                visible: true,
                color: VECTOR_COLORS[prev.length % VECTOR_COLORS.length]
            };
            return [...prev, newVector];
        });
    }, []);

    const handleRemoveVector = useCallback((id: number) => {
        setVectors(prev => prev.filter(v => v.id !== id));
    }, []);

    const handleVectorChange = useCallback((id: number, newValue: Vector3) => {
        setVectors(prev => prev.map(v => v.id === id ? { ...v, value: newValue } : v));
    }, []);
    
    const handleVectorColorChange = useCallback((id: number, newColor: string) => {
        setVectors(prev => prev.map(v => v.id === id ? { ...v, color: newColor } : v));
    }, []);

    const handleToggleVectorVisibility = useCallback((id: number) => {
        setVectors(prev => prev.map(v => v.id === id ? { ...v, visible: !v.visible } : v));
    }, []);

    const handleNormalizeVectors = useCallback(() => {
        setVectors(prev => prev.map(vector => {
            const [x, y, z] = vector.value;
            const length = Math.hypot(x, y, z);
            if (!Number.isFinite(length) || length === 0) {
                return vector;
            }
            const normalized: Vector3 = [x / length, y / length, z / length];
            return { ...vector, value: normalized };
        }));
    }, []);

    const handleAddWall = useCallback(() => {
        const newWall: Wall = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            axis: 'x',
            position: 0
        };
        setWalls(prev => [...prev, newWall]);
    }, []);

    const handleUpdateWall = useCallback((id: number, updates: Partial<Wall>) => {
        setWalls(prev => prev.map(wall => {
            if (wall.id !== id) return wall;
            const nextPosition = updates.position !== undefined ? (Number.isFinite(updates.position) ? updates.position : wall.position) : wall.position;
            const nextAxis = updates.axis ?? wall.axis;
            return { ...wall, axis: nextAxis, position: nextPosition };
        }));
    }, []);

    const handleRemoveWall = useCallback((id: number) => {
        setWalls(prev => prev.filter(wall => wall.id !== id));
    }, []);

    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            stopAnimation();
        } else {
             if (t >= animationConfig.endT) {
                setT(animationConfig.startT); 
                animationDirectionRef.current = 1;
             }
             setIsPlaying(true);
        }
    }, [isPlaying, t, animationConfig.startT, animationConfig.endT, stopAnimation]);

    const handleTChange = useCallback((newT: number) => {
        stopAnimation();
        setT(newT);
    },[stopAnimation]);

    const handleMatrixScalarChange = useCallback((value: number) => {
        const safeValue = Number.isFinite(value) ? value : 1;
        setMatrixScalar(safeValue);
    }, []);

    const handleMatrixExponentChange = useCallback((value: number) => {
        const baseValue = Number.isFinite(value) ? value : 1;
        const sanitized = Math.max(1, Math.round(baseValue));
        setMatrixExponent(sanitized);
    }, []);

    const handleNormalizeToggle = useCallback((enabled: boolean) => {
        setNormalizeMatrix(enabled);
        if (!enabled) {
            setNormalizationWarning(null);
        }
    }, []);

    const handleLinearInterpolationToggle = useCallback((enabled: boolean) => {
        setLinearEigenInterpolation(enabled);
    }, []);

    const handleRepeatToggle = useCallback((enabled: boolean) => {
        setRepeatAnimation(enabled);
        if (!enabled) {
            animationDirectionRef.current = 1;
        }
    }, []);

    const handleFadingPathLengthChange = useCallback((length: number) => {
        const safeLength = Number.isFinite(length) ? Math.max(2, Math.min(600, Math.round(length))) : 120;
        setFadingPathLength(safeLength);
    }, []);

    const profileSnapshot = useMemo<ProfileData>(() => {
        const clonedMatrix = matrixA.map(row => [...row] as Vector3) as Matrix3;
        const clonedVectors = vectors.map(vector => ({
            ...vector,
            value: [...vector.value] as Vector3
        }));
        const clonedWalls = walls.map(wall => ({ ...wall }));
        return {
            version: getProfileVersion(),
            matrixA: clonedMatrix,
            vectors: clonedVectors,
            walls: clonedWalls,
            t,
            tPrecision,
            dotMode,
            fadingPath,
            fadingPathLength,
            fadingPathStyle,
            showStartMarkers,
            showEndMarkers,
            dynamicFadingPath,
            animationConfig: {
                duration: animationConfig.duration,
                startT: animationConfig.startT,
                endT: animationConfig.endT,
                easing: animationConfig.easing
            },
            repeatAnimation,
            activation: {
                name: activation.name,
                customFnStr: activation.customFnStr
            },
            selectedPresetName,
            matrixScalar,
            matrixExponent,
            normalizeMatrix,
            linearEigenInterpolation
        };
    }, [
        matrixA,
        vectors,
        walls,
        t,
        tPrecision,
        dotMode,
        fadingPath,
        fadingPathLength,
        fadingPathStyle,
        showStartMarkers,
        showEndMarkers,
        dynamicFadingPath,
        animationConfig.duration,
        animationConfig.startT,
        animationConfig.endT,
        animationConfig.easing,
        repeatAnimation,
        activation.name,
        activation.customFnStr,
        selectedPresetName,
        matrixScalar,
        matrixExponent,
        normalizeMatrix,
        linearEigenInterpolation
    ]);

    const applyProfileData = useCallback((rawData: ProfileData | null) => {
        const data = sanitizeProfileData(rawData);
        if (!data) {
            return;
        }
        stopAnimation();
        setMatrixA(data.matrixA);
        setVectors(data.vectors);
        setWalls(data.walls);
        handleMatrixScalarChange(data.matrixScalar);
        handleMatrixExponentChange(data.matrixExponent);
        setNormalizeMatrix(data.normalizeMatrix);
        setLinearEigenInterpolation(data.linearEigenInterpolation);
        setDotMode(data.dotMode);
        setFadingPath(data.fadingPath);
        handleFadingPathLengthChange(data.fadingPathLength);
        setFadingPathStyle(data.fadingPathStyle);
        setShowStartMarkers(data.showStartMarkers);
        setShowEndMarkers(data.showEndMarkers);
        setDynamicFadingPath(data.dynamicFadingPath);
        setAnimationConfig({
            duration: data.animationConfig.duration,
            startT: data.animationConfig.startT,
            endT: data.animationConfig.endT,
            easing: data.animationConfig.easing
        });
        setRepeatAnimation(data.repeatAnimation);
        setActivation(prev => ({
            ...prev,
            name: data.activation.name,
            customFnStr: data.activation.customFnStr
        }));
        setSelectedPresetName(data.selectedPresetName);
        setTPrecision(data.tPrecision);
        setT(data.t);
        setError(null);
    }, [
        stopAnimation,
        handleMatrixScalarChange,
        handleMatrixExponentChange,
        handleFadingPathLengthChange
    ]);

    const refreshProfileSummaries = useCallback(() => {
        setProfileSummaries(listProfiles());
    }, []);

    useEffect(() => {
        refreshProfileSummaries();
        const lastUsed = loadLastUsedProfile();
        if (lastUsed) {
            const stored = loadStoredProfile(lastUsed);
            if (stored) {
                applyProfileData(stored);
                setActiveProfileName(lastUsed);
                return;
            }
        }
        const lastSession = loadLastSession();
        if (lastSession) {
            applyProfileData(lastSession);
            setActiveProfileName(null);
        }
    }, [applyProfileData, refreshProfileSummaries]);

    useEffect(() => {
        saveLastSession(profileSnapshot);
    }, [profileSnapshot]);

    useEffect(() => {
        saveLastUsedProfile(activeProfileName);
    }, [activeProfileName]);

    const handleProfileSave = useCallback((name: string): ProfileOperationResult => {
        const trimmed = name.trim();
        if (!trimmed) {
            return { success: false, status: 'error', message: 'Profile name cannot be empty.' };
        }
        try {
            const result = persistProfile(trimmed, profileSnapshot);
            refreshProfileSummaries();
            setActiveProfileName(trimmed);
            return result === 'created'
                ? { success: true, status: 'success', message: `Saved profile "${trimmed}".` }
                : { success: true, status: 'info', message: `Updated profile "${trimmed}".` };
        } catch (error) {
            console.error('Profile save failed:', error);
            return { success: false, status: 'error', message: 'Failed to save profile.' };
        }
    }, [profileSnapshot, refreshProfileSummaries]);

    const handleProfileLoad = useCallback((name: string): ProfileOperationResult => {
        const trimmed = name.trim();
        if (!trimmed) {
            return { success: false, status: 'error', message: 'Select a profile to load.' };
        }
        const stored = loadStoredProfile(trimmed);
        if (!stored) {
            return { success: false, status: 'error', message: 'Profile not found.' };
        }
        applyProfileData(stored);
        refreshProfileSummaries();
        setActiveProfileName(trimmed);
        return { success: true, status: 'success', message: `Loaded profile "${trimmed}".` };
    }, [applyProfileData, refreshProfileSummaries]);

    const handleProfileDelete = useCallback((name: string): ProfileOperationResult => {
        const trimmed = name.trim();
        if (!trimmed) {
            return { success: false, status: 'error', message: 'Select a profile to delete.' };
        }
        const removed = removeStoredProfile(trimmed);
        if (!removed) {
            return { success: false, status: 'error', message: 'Profile not found.' };
        }
        refreshProfileSummaries();
        if (activeProfileName === trimmed) {
            setActiveProfileName(null);
        }
        return { success: true, status: 'info', message: `Deleted profile "${trimmed}".` };
    }, [refreshProfileSummaries, activeProfileName]);

    // --- Derived Matrix Configuration ---

    const matrixPreparation = useMemo(() => {
        const toNumber = (val: unknown): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'object' && val !== null && 're' in (val as any)) {
                return Number((val as { re: number }).re);
            }
            const parsed = Number(val);
            return Number.isFinite(parsed) ? parsed : 0;
        };

        const toMatrix3 = (input: number[][]): Matrix3 => {
            return input.map(row => [toNumber(row[0]), toNumber(row[1]), toNumber(row[2])] as Vector3) as Matrix3;
        };

        const safeScalar = Number.isFinite(matrixScalar) ? matrixScalar : 1;
        const safeExponent = Math.max(1, Math.round(Number.isFinite(matrixExponent) ? matrixExponent : 1));

        try {
            const baseMatrix = math.matrix(matrixA);
            const scaledMatrix = math.multiply(baseMatrix, safeScalar) as math.Matrix;
            const poweredMatrix = safeExponent === 1 ? scaledMatrix : (math.pow(scaledMatrix, safeExponent) as math.Matrix);
            const poweredArray = poweredMatrix.toArray() as number[][];
            const adjustedMatrix = toMatrix3(poweredArray);

            const determinantBefore = Number(math.det(poweredMatrix));
            let normalizationApplied = false;
            let normalizationFailed = false;
            let determinantAfter: number | null = null;
            let effectiveMatrix = adjustedMatrix;

            if (normalizeMatrix) {
                if (Math.abs(determinantBefore) < 1e-8) {
                    normalizationFailed = true;
                } else {
                    const detRoot = Math.cbrt(Math.abs(determinantBefore));
                    const normalizedMatrix = math.divide(poweredMatrix, detRoot) as math.Matrix;
                    const normalizedArray = normalizedMatrix.toArray() as number[][];
                    effectiveMatrix = toMatrix3(normalizedArray);
                    normalizationApplied = true;
                    determinantAfter = Number(math.det(normalizedMatrix));
                }
            }

            return {
                matrix: effectiveMatrix,
                adjustedMatrix,
                scalar: safeScalar,
                exponent: safeExponent,
                normalizationApplied,
                normalizationFailed,
                determinantBefore,
                determinantAfter,
                error: null as string | null,
            };
        } catch (err) {
            console.error('Matrix adjustment error:', err);
            return {
                matrix: null,
                adjustedMatrix: matrixA,
                scalar: safeScalar,
                exponent: safeExponent,
                normalizationApplied: false,
                normalizationFailed: false,
                determinantBefore: null,
                determinantAfter: null,
                error: 'Matrix adjustment error. Check scalar or exponent values.'
            };
        }
    }, [matrixA, matrixScalar, matrixExponent, normalizeMatrix]);

    useEffect(() => {
        if (normalizeMatrix && matrixPreparation.normalizationFailed) {
            setNormalizationWarning('Normalization requires a non-zero determinant. Matrix left unnormalized.');
            setNormalizeMatrix(false);
        } else if (normalizeMatrix && matrixPreparation.normalizationApplied) {
            setNormalizationWarning(null);
        }
    }, [normalizeMatrix, matrixPreparation.normalizationFailed, matrixPreparation.normalizationApplied]);

    useEffect(() => {
        setNormalizationWarning(null);
    }, [matrixA, matrixScalar, matrixExponent]);

    const matrixEvaluator = useMemo(() => {
        if (!matrixPreparation.matrix) return null;
        return createMatrixEvaluator(matrixPreparation.matrix);
    }, [matrixPreparation.matrix]);

    const samplingConfig = useMemo(() => {
        const range = animationConfig.endT - animationConfig.startT;
        const safePrecision = Number.isFinite(tPrecision) && tPrecision > 0 ? tPrecision : 0.01;
        const baseStep = 1 / PATH_RESOLUTION;
        const effectiveStep = Math.min(safePrecision, baseStep);

        if (range <= 0) {
            return { times: [] as number[], range, totalSteps: 0 };
        }

        const totalSteps = Math.max(1, Math.ceil(range / effectiveStep));
        const times: number[] = new Array(totalSteps + 1);
        for (let i = 0; i <= totalSteps; i++) {
            times[i] = animationConfig.startT + (i / totalSteps) * range;
        }

        return { times, range, totalSteps };
    }, [animationConfig.startT, animationConfig.endT, tPrecision]);

    const matrixSamples = useMemo(() => {
        if (!matrixEvaluator) return null;
        const { times } = samplingConfig;
        if (times.length === 0) return [];
        return times.map(time => matrixEvaluator.getMatrixAt(time, { linearEigenInterpolation }));
    }, [matrixEvaluator, samplingConfig, linearEigenInterpolation]);

    // --- Memoized Calculations ---

    const vectorTransformationsResult = useMemo(() => {
        if (matrixPreparation.error) {
            return { transformations: null as TransformationsMap | null, error: matrixPreparation.error };
        }

        if (activation.error) {
            return { transformations: null as TransformationsMap | null, error: `Activation Function Error: ${activation.error}` };
        }

        if (!matrixEvaluator) {
            return { transformations: null as TransformationsMap | null, error: 'Matrix unavailable.' };
        }

        const range = samplingConfig.range;
        if (range <= 0) {
            return { transformations: null as TransformationsMap | null, error: "Animation End Time must be greater than Start Time." };
        }

        if (!matrixSamples) {
            return { transformations: null as TransformationsMap | null, error: 'Matrix generation failed.' };
        }

        if (matrixSamples.some(sample => !sample)) {
            return { transformations: null as TransformationsMap | null, error: 'Matrix generation failed at specific time samples.' };
        }

        const transformations: TransformationsMap = {};
        let calculationError = false;
        const activationFn = activation.currentFn;

        for (const vector of vectors) {
            const fullPath: THREE.Vector3[] = [];

            for (const sample of matrixSamples) {
                if (!sample) {
                    calculationError = true;
                    break;
                }
                const rawPoint = multiplyMatrixVector(sample, vector.value);
                const activatedPoint = rawPoint.map(activationFn) as Vector3;
                fullPath.push(new THREE.Vector3(...activatedPoint));
            }
            if (calculationError || fullPath.length === 0) {
                calculationError = true;
                break;
            }

            const initial = fullPath[0]?.clone() ?? new THREE.Vector3(...vector.value.map(activationFn) as Vector3);
            const final = fullPath[fullPath.length - 1]?.clone() ?? initial.clone();

            transformations[vector.id] = { initial, final, fullPath };
        }
        
        if (calculationError) {
            return { transformations: null as TransformationsMap | null, error: "Calculation Error: The matrix might be singular or non-diagonalizable." };
        }

        return { transformations, error: null as string | null };
    }, [matrixPreparation, vectors, activation.currentFn, activation.error, matrixEvaluator, matrixSamples, samplingConfig.range]);
    const vectorTransformations = vectorTransformationsResult.transformations;


    const sceneData = useMemo(() => {
        if (!vectorTransformations) return [];
        const range = animationConfig.endT - animationConfig.startT;
        if (range <= 0) return [];

        const prevT = previousTRef.current;
        const isReversing = t < prevT;
        const deltaT = Math.abs(t - prevT);
        previousTRef.current = t;
        const axisAccess = {
            x: (vec: THREE.Vector3) => vec.x,
            y: (vec: THREE.Vector3) => vec.y,
            z: (vec: THREE.Vector3) => vec.z
        };

        const setAxis = (vec: THREE.Vector3, axis: Wall['axis'], value: number) => {
            if (axis === 'x') vec.setX(value);
            if (axis === 'y') vec.setY(value);
            if (axis === 'z') vec.setZ(value);
        };

        const resolveNormalDirection = (primary: number, secondary?: number): 1 | -1 => {
            if (Math.abs(primary) > 1e-6) {
                return primary >= 0 ? 1 : -1;
            }
            if (secondary !== undefined && Math.abs(secondary) > 1e-6) {
                return secondary >= 0 ? 1 : -1;
            }
            return 1;
        };

        const computeContact = (wall: Wall, current: THREE.Vector3, previous: THREE.Vector3 | null): WallContact | null => {
            const currentValue = axisAccess[wall.axis](current);
            const diffCurrent = currentValue - wall.position;

            if (Math.abs(diffCurrent) <= CONTACT_TOLERANCE) {
                const contactPoint = current.clone();
                setAxis(contactPoint, wall.axis, wall.position);
                const normalDirection = resolveNormalDirection(diffCurrent, previous ? axisAccess[wall.axis](previous) - wall.position : undefined);
                return { wallId: wall.id, axis: wall.axis, position: wall.position, point: contactPoint, normalDirection };
            }

            if (previous) {
                const prevValue = axisAccess[wall.axis](previous);
                const diffPrev = prevValue - wall.position;

                if (Math.abs(diffPrev) <= CONTACT_TOLERANCE) {
                    const contactPoint = previous.clone();
                    setAxis(contactPoint, wall.axis, wall.position);
                    const normalDirection = resolveNormalDirection(diffPrev, diffCurrent);
                    return { wallId: wall.id, axis: wall.axis, position: wall.position, point: contactPoint, normalDirection };
                }

                if (diffPrev * diffCurrent < 0) {
                    const denominator = currentValue - prevValue;
                    if (Math.abs(denominator) > 1e-8) {
                        const ratio = (wall.position - prevValue) / denominator;
                        const clampedRatio = THREE.MathUtils.clamp(ratio, 0, 1);
                        const contactPoint = previous.clone().lerp(current, clampedRatio);
                        setAxis(contactPoint, wall.axis, wall.position);
                        const normalDirection = resolveNormalDirection(diffCurrent, diffPrev);
                        return { wallId: wall.id, axis: wall.axis, position: wall.position, point: contactPoint, normalDirection };
                    }
                }
            }

            return null;
        };
        
        const direction = isReversing ? -1 : 1;

        if (dynamicFadingPath && fadingPath) {
            const visibleIds = new Set(vectors.filter(v => v.visible).map(v => v.id));
            dynamicTrailPointsRef.current.forEach((_, key) => {
                if (!visibleIds.has(key)) {
                    dynamicTrailPointsRef.current.delete(key);
                    previousSampleIndexRef.current.delete(key);
                }
            });
        }

        return vectors
            .filter(v => v.visible)
            .map(vector => {
                const transform = vectorTransformations[vector.id];
                const progress = (t - animationConfig.startT) / range;
                const sliceEnd = Math.floor(progress * (transform.fullPath.length - 1));
                const clampedIndex = THREE.MathUtils.clamp(sliceEnd, 0, transform.fullPath.length - 1);
                const maxTrail = Math.min(fadingPathLength, transform.fullPath.length);

                let currentPath: THREE.Vector3[];
                if (dynamicFadingPath && fadingPath) {
                    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
                    const maxSamples = Math.max(2, Math.min(maxTrail, Math.round(Math.max(2, fadingPathLength))));
                    const windowMs = THREE.MathUtils.lerp(450, 6500, THREE.MathUtils.clamp(fadingPathLength / 400, 0, 1));

                    let samples = dynamicTrailPointsRef.current.get(vector.id) ?? [];
                    let prevIndexStored = previousSampleIndexRef.current.get(vector.id);

                    const pushSample = (index: number, timestamp: number) => {
                        const point = transform.fullPath[index];
                        if (!point) return;
                        samples.push({ position: point.clone(), timestamp, index });
                    };

                    if (prevIndexStored === undefined || prevIndexStored < 0 || prevIndexStored >= transform.fullPath.length) {
                        samples = [];
                        prevIndexStored = clampedIndex;
                    }

                    const lastSample = samples[samples.length - 1];
                    const step = prevIndexStored < clampedIndex ? 1 : -1;
                    const forward = step === 1;
                    const missingForward = forward
                        ? prevIndexStored !== undefined && prevIndexStored > clampedIndex
                        : prevIndexStored !== undefined && prevIndexStored < clampedIndex;
                    const shouldReset = missingForward || Math.abs(prevIndexStored - clampedIndex) > maxSamples * 2;

                    if (shouldReset) {
                        samples = [];
                        prevIndexStored = forward ? Math.max(0, clampedIndex - 1) : Math.min(transform.fullPath.length - 1, clampedIndex + 1);
                    }

                    if (prevIndexStored === undefined) {
                        pushSample(clampedIndex, now);
                    } else if (prevIndexStored !== clampedIndex) {
                        const fillStep = prevIndexStored < clampedIndex ? 1 : -1;
                        for (let idx = prevIndexStored + fillStep; idx !== clampedIndex + fillStep; idx += fillStep) {
                            pushSample(idx, now);
                        }
                    } else if (!lastSample || now - lastSample.timestamp > 120) {
                        pushSample(clampedIndex, now);
                    }

                    previousSampleIndexRef.current.set(vector.id, clampedIndex);

                    samples = samples.filter(sample => now - sample.timestamp <= windowMs);

                    if (samples.length === 0) {
                        pushSample(clampedIndex, now);
                    }

                    if (samples.length > maxSamples) {
                        samples = samples.slice(samples.length - maxSamples);
                    }

                    dynamicTrailPointsRef.current.set(vector.id, samples);

                    currentPath = samples.map(sample => sample.position.clone());
                } else {
                    previousSampleIndexRef.current.set(vector.id, clampedIndex);
                    dynamicTrailPointsRef.current.delete(vector.id);
                    if (fadingPath) {
                        const start = Math.max(0, clampedIndex - maxTrail + 1);
                        currentPath = transform.fullPath.slice(start, clampedIndex + 1);
                    } else {
                        currentPath = transform.fullPath.slice(0, clampedIndex + 1);
                    }
                }
                const interpolatedVector = currentPath[currentPath.length - 1] || transform.initial;
                const previousVector = currentPath.length > 1 ? currentPath[currentPath.length - 2] : transform.initial;

                const contacts: WallContact[] = [];
                walls.forEach(wall => {
                    const contact = computeContact(wall, interpolatedVector, previousVector);
                    if (contact) {
                        contacts.push(contact);
                    }
                });

                return {
                    id: vector.id,
                    color: vector.color,
                    initialVector: transform.initial,
                    finalVector: transform.final,
                    interpolatedVector: interpolatedVector,
                    path: currentPath,
                    contacts,
                };
            });
    }, [t, vectors, vectorTransformations, animationConfig.startT, animationConfig.endT, walls, fadingPath, dynamicFadingPath, fadingPathLength]);

    const wallContactCounts = useMemo(() => {
        const counts: Record<number, number> = {};
        sceneData.forEach(entry => {
            entry.contacts.forEach(contact => {
                counts[contact.wallId] = (counts[contact.wallId] ?? 0) + 1;
            });
        });
        return counts;
    }, [sceneData]);

    const effectiveEigenvalues = useMemo<Eigenvalue[] | null>(() => {
        if (!matrixEvaluator) return null;
        return mapEigenvalues(matrixEvaluator.eigenValues);
    }, [matrixEvaluator]);

    const matrixAt = useMemo(() => {
        if (!matrixEvaluator) return null;
        return matrixEvaluator.getMatrixAt(t, { linearEigenInterpolation });
    }, [matrixEvaluator, t, linearEigenInterpolation]);

    const matrixAtDeterminant = useMemo(() => {
        if (!matrixAt) return null;
        try {
            const detValue = math.det(matrixAt as unknown as number[][]) as unknown;
            if (typeof detValue === 'number') {
                return Number.isFinite(detValue) ? detValue : null;
            }
            if (detValue && typeof detValue === 'object' && 're' in detValue) {
                const real = (detValue as { re: number }).re;
                return Number.isFinite(real) ? real : null;
            }
            return null;
        } catch {
            return null;
        }
    }, [matrixAt]);

    const matrixAtEigenvalues = useMemo<Eigenvalue[] | null>(() => {
        if (!matrixEvaluator) return null;
        const eigenValuesAtT = matrixEvaluator.eigenValues.map(value =>
            interpolateEigenvalue(value, t, { linearEigenInterpolation })
        );
        return mapEigenvalues(eigenValuesAtT);
    }, [matrixEvaluator, t, linearEigenInterpolation]);

    const firstVisibleVector = vectors.find(v => v.visible);
    const firstVisibleSceneData = firstVisibleVector ? sceneData.find(d => d.id === firstVisibleVector.id) : null;

    const rawTransformedV = useMemo(() => {
        if (!firstVisibleVector || !matrixEvaluator) return null;
        return matrixEvaluator.applyToVector(
            t,
            firstVisibleVector.value,
            { linearEigenInterpolation }
        );
    }, [matrixEvaluator, t, firstVisibleVector, linearEigenInterpolation]);

    useEffect(() => {
        if (vectorTransformationsResult.error) {
            setError(vectorTransformationsResult.error);
        } else if (normalizationWarning) {
            setError(normalizationWarning);
        } else {
            setError(null);
        }
    }, [vectorTransformationsResult.error, normalizationWarning]);


    return (
        <div className="w-screen h-screen flex flex-col md:flex-row bg-gray-900 overflow-hidden">
            <ControlsPanel
                matrix={matrixA}
                vectors={vectors}
                walls={walls}
                t={t}
                tPrecision={tPrecision}
                dotMode={dotMode}
                fadingPath={fadingPath}
                fadingPathLength={fadingPathLength}
                fadingPathStyle={fadingPathStyle}
                showStartMarkers={showStartMarkers}
                showEndMarkers={showEndMarkers}
                dynamicFadingPath={dynamicFadingPath}
                isPlaying={isPlaying}
                animationConfig={animationConfig}
                repeatAnimation={repeatAnimation}
                activationConfig={activation}
                selectedPresetName={selectedPresetName}
                matrixScalar={matrixScalar}
                matrixExponent={matrixExponent}
                normalizeMatrix={normalizeMatrix}
                linearEigenInterpolation={linearEigenInterpolation}
                normalizationWarning={normalizationWarning}
                onMatrixChange={handleMatrixChange}
                onPresetSelect={handlePresetSelect}
                onMatrixScalarChange={handleMatrixScalarChange}
                onMatrixExponentChange={handleMatrixExponentChange}
                onNormalizeToggle={handleNormalizeToggle}
                onLinearInterpolationToggle={handleLinearInterpolationToggle}
                onVectorChange={handleVectorChange}
                onVectorColorChange={handleVectorColorChange}
                onAddVector={handleAddVector}
                onNormalizeVectors={handleNormalizeVectors}
                onRemoveVector={handleRemoveVector}
                onToggleVisibility={handleToggleVectorVisibility}
                onTChange={handleTChange}
                onTPrecisionChange={setTPrecision}
                onDotModeChange={setDotMode}
                onFadingPathToggle={setFadingPath}
                onFadingPathLengthChange={handleFadingPathLengthChange}
                onFadingPathStyleChange={setFadingPathStyle}
                onDynamicFadingPathChange={setDynamicFadingPath}
                onShowStartMarkersChange={setShowStartMarkers}
                onShowEndMarkersChange={setShowEndMarkers}
                onResetTime={resetTime}
                onPlayPause={handlePlayPause}
                onAnimationConfigChange={setAnimationConfig}
                onRepeatToggle={handleRepeatToggle}
                onActivationConfigChange={setActivation}
                onAddWall={handleAddWall}
                onUpdateWall={handleUpdateWall}
                onRemoveWall={handleRemoveWall}
                profileSummaries={profileSummaries}
                activeProfileName={activeProfileName}
                onProfileSave={handleProfileSave}
                onProfileLoad={handleProfileLoad}
                onProfileDelete={handleProfileDelete}
                error={error}
            />
            <div className="flex-grow h-1/2 md:h-full w-full md:w-auto relative pointer-events-none">
                 <div className="absolute inset-0 pointer-events-auto">
                    <Scene
                        sceneData={sceneData}
                        walls={walls}
                        dotMode={dotMode}
                        fadingPath={fadingPath}
                        fadingPathLength={fadingPathLength}
                        fadingPathStyle={fadingPathStyle}
                        showStartMarkers={showStartMarkers}
                        showEndMarkers={showEndMarkers}
                        dynamicFadingPath={dynamicFadingPath}
                    />
                 </div>
                 <InfoPanel
                    baseMatrix={matrixA}
                    effectiveMatrix={matrixPreparation.matrix}
                    matrixScalar={matrixScalar}
                    matrixExponent={matrixPreparation.exponent}
                    normalizeRequested={normalizeMatrix}
                    normalizeApplied={matrixPreparation.normalizationApplied}
                    determinantBefore={matrixPreparation.determinantBefore}
                    determinantAfter={matrixPreparation.determinantAfter}
                    normalizationWarning={normalizationWarning}
                    walls={walls}
                    wallContactCounts={wallContactCounts}
                    eigenvalues={effectiveEigenvalues}
                    eigenvaluesAtT={matrixAtEigenvalues}
                    matrixAt={matrixAt}
                    determinantAtT={matrixAtDeterminant}
                    vectorV={firstVisibleVector?.value || null}
                    rawTransformedV={rawTransformedV}
                    transformedV={firstVisibleSceneData?.interpolatedVector ? [firstVisibleSceneData.interpolatedVector.x, firstVisibleSceneData.interpolatedVector.y, firstVisibleSceneData.interpolatedVector.z] : null}
                    activationFnName={activation.name}
                    customActivationFnStr={activation.customFnStr}
                 />
            </div>
        </div>
    );
}

export default App;
