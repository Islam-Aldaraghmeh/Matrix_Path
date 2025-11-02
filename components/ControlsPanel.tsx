import React, { useState, useEffect } from 'react';
import type { Matrix3, Vector3, VectorObject, Wall } from '../types';
import type { ActivationFunction } from '../utils/activationFunctions';
import { easingFunctions } from '../utils/easing';
import { PRESET_MATRICES } from '../App';
import { PRESET_ACTIVATION_FUNCTIONS } from '../utils/activationFunctions';
import type { FadingPathStyle } from '../App';


interface AnimationConfig {
    duration: number;
    startT: number;
    endT: number;
    easing: keyof typeof easingFunctions;
}
interface ActivationConfig {
    name: string;
    customFnStr: string;
    currentFn: ActivationFunction;
    error: string | null;
}

interface ControlsPanelProps {
    matrix: Matrix3;
    vectors: VectorObject[];
    walls: Wall[];
    t: number;
    tPrecision: number;
    dotMode: boolean;
    fadingPath: boolean;
    fadingPathLength: number;
    fadingPathStyle: FadingPathStyle;
    showStartMarkers: boolean;
    showEndMarkers: boolean;
    dynamicFadingPath: boolean;
    isPlaying: boolean;
    animationConfig: AnimationConfig;
    repeatAnimation: boolean;
    activationConfig: ActivationConfig;
    selectedPresetName: string;
    matrixScalar: number;
    matrixExponent: number;
    normalizeMatrix: boolean;
    linearEigenInterpolation: boolean;
    normalizationWarning: string | null;
    onMatrixChange: (matrix: Matrix3) => void;
    onPresetSelect: (name: string) => void;
    onMatrixScalarChange: (value: number) => void;
    onMatrixExponentChange: (value: number) => void;
    onNormalizeToggle: (enabled: boolean) => void;
    onLinearInterpolationToggle: (enabled: boolean) => void;
    onVectorChange: (id: number, value: Vector3) => void;
    onVectorColorChange: (id: number, color: string) => void;
    onAddVector: () => void;
    onNormalizeVectors: () => void;
    onRemoveVector: (id: number) => void;
    onToggleVisibility: (id: number) => void;
    onTChange: (t: number) => void;
    onTPrecisionChange: (precision: number) => void;
    onDotModeChange: (enabled: boolean) => void;
    onFadingPathToggle: (enabled: boolean) => void;
    onFadingPathLengthChange: (length: number) => void;
    onFadingPathStyleChange: (style: FadingPathStyle) => void;
    onShowStartMarkersChange: (enabled: boolean) => void;
    onShowEndMarkersChange: (enabled: boolean) => void;
    onDynamicFadingPathChange: (enabled: boolean) => void;
    onResetTime: () => void;
    onPlayPause: () => void;
    onAnimationConfigChange: (config: AnimationConfig) => void;
    onRepeatToggle: (enabled: boolean) => void;
    onActivationConfigChange: (config: ActivationConfig) => void;
    onAddWall: () => void;
    onUpdateWall: (id: number, updates: Partial<Wall>) => void;
    onRemoveWall: (id: number) => void;
    error: string | null;
}

const NumberInput: React.FC<{
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    className?: string;
    step?: number;
    min?: number;
    max?: number;
}> = ({ value, onChange, disabled, className = "", step = 0.1, min, max }) => (
    <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-20 bg-gray-700 text-white rounded p-2 text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 ${className}`}
        disabled={disabled}
    />
);

const VectorControls: React.FC<{
    vector: VectorObject;
    onVectorChange: (id: number, value: Vector3) => void;
    onVectorColorChange: (id: number, color: string) => void;
    onRemoveVector: (id: number) => void;
    onToggleVisibility: (id: number) => void;
}> = ({ vector, onVectorChange, onVectorColorChange, onRemoveVector, onToggleVisibility }) => {
    
    const handleValueChange = (index: number, value: number) => {
        const newVector = [...vector.value] as Vector3;
        newVector[index] = value;
        onVectorChange(vector.id, newVector);
    };

    return (
        <div className="p-3 bg-gray-900/50 rounded-lg">
            <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-md flex-shrink-0">
                    <div className="w-full h-full rounded-md" style={{ backgroundColor: vector.color }} />
                    <input
                        type="color"
                        value={vector.color}
                        onChange={(e) => onVectorColorChange(vector.id, e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        aria-label="Change vector color"
                    />
                </div>
                <div className="grid grid-cols-3 gap-2 flex-grow">
                    {vector.value.map((val, i) => (
                        <NumberInput key={i} value={val} onChange={(v) => handleValueChange(i, v)} className="w-full" />
                    ))}
                </div>
                <button onClick={() => onToggleVisibility(vector.id)} className="p-2 text-gray-400 hover:text-white transition-colors" aria-label={vector.visible ? 'Hide vector' : 'Show vector'}>
                    {vector.visible ? 
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                        : 
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2 2 0 012.828 2.828l1.515 1.515A4 4 0 0014 10a4 4 0 10-5.432-3.432z" clipRule="evenodd" /></svg>
                    }
                </button>
                <button onClick={() => onRemoveVector(vector.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" aria-label="Remove vector">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                </button>
            </div>
        </div>
    )
}

const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors 
            ${active ? 'bg-gray-800 text-cyan-400' : 'bg-gray-900 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
    >
        {children}
    </button>
);


const ControlsPanel: React.FC<ControlsPanelProps> = (props) => {
    const {
        matrix,
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
        isPlaying,
        animationConfig,
        repeatAnimation,
        activationConfig,
        selectedPresetName,
        matrixScalar,
        matrixExponent,
        normalizeMatrix,
        linearEigenInterpolation,
        normalizationWarning,
        onMatrixChange,
        onPresetSelect,
        onMatrixScalarChange,
        onMatrixExponentChange,
        onNormalizeToggle,
        onLinearInterpolationToggle,
        onVectorChange,
        onVectorColorChange,
        onAddVector,
        onNormalizeVectors,
        onRemoveVector,
        onToggleVisibility,
        onTChange,
        onTPrecisionChange,
        onDotModeChange,
        onFadingPathToggle,
        onFadingPathLengthChange,
        onFadingPathStyleChange,
        onDynamicFadingPathChange,
        onShowStartMarkersChange,
        onShowEndMarkersChange,
        onResetTime,
        onPlayPause,
        onAnimationConfigChange,
        onRepeatToggle,
        onActivationConfigChange,
        onAddWall,
        onUpdateWall,
        onRemoveWall,
        error
    } = props;
    
    const [activeTab, setActiveTab] = useState<'controls' | 'animation' | 'walls'>('controls');

    const handleMatrixValueChange = (row: number, col: number, value: number) => {
        const newMatrix = matrix.map(r => [...r]) as Matrix3;
        newMatrix[row][col] = value;
        onMatrixChange(newMatrix);
    };

    const handleStartTChange = (value: number) => {
        const updatedConfig = { 
            ...animationConfig, 
            startT: value, 
            endT: Math.max(value, animationConfig.endT) 
        };
        onAnimationConfigChange(updatedConfig);
        if (t < updatedConfig.startT) {
            onTChange(updatedConfig.startT);
        }
    };

    const handleEndTChange = (value: number) => {
        const updatedConfig = { 
            ...animationConfig, 
            endT: Math.max(value, animationConfig.startT) 
        };
        onAnimationConfigChange(updatedConfig);
        if (t > updatedConfig.endT) {
            onTChange(updatedConfig.endT);
        }
    };

    const handleRandomMatrix = () => {
        const randomValue = () => parseFloat((Math.random() * 4 - 2).toFixed(2));
        const randomMatrix: Matrix3 = [
            [randomValue(), randomValue(), randomValue()],
            [randomValue(), randomValue(), randomValue()],
            [randomValue(), randomValue(), randomValue()],
        ];
        onMatrixChange(randomMatrix);
    };

    const handlePrecisionChange = (sliderValue: number) => {
        const newPrecision = Math.pow(10, -sliderValue);
        onTPrecisionChange(newPrecision);
    };

    const getPrecisionSliderValue = (precision: number): number => {
        return Math.max(1, -Math.log10(precision));
    };

    // --- Preset Slider Logic ---
    const sliderPresets = PRESET_MATRICES.filter(p => p.name !== 'Custom');
    const currentSliderIndex = sliderPresets.findIndex(p => p.name === selectedPresetName);
    const [lastSliderIndex, setLastSliderIndex] = useState(() => Math.max(0, currentSliderIndex));

    useEffect(() => {
        if (currentSliderIndex !== -1) {
            setLastSliderIndex(currentSliderIndex);
        }
    }, [currentSliderIndex]);
    
    return (
        <div className="w-full md:w-96 bg-gray-800 flex flex-col flex-shrink-0 shadow-2xl z-10">
             <div className="p-6 pb-0">
                <h1 className="text-2xl font-bold text-cyan-400 mb-1">Matrix Transformation</h1>
                <p className="text-lg text-gray-300 mb-4 font-mono">f(A<sup>t</sup>v) Visualizer</p>
            </div>
            
            <div className="border-b border-gray-700 px-4">
                <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                    <TabButton active={activeTab === 'controls'} onClick={() => setActiveTab('controls')}>Controls</TabButton>
                    <TabButton active={activeTab === 'animation'} onClick={() => setActiveTab('animation')}>Config</TabButton>
                    <TabButton active={activeTab === 'walls'} onClick={() => setActiveTab('walls')}>Walls</TabButton>
                </nav>
            </div>

            <div className="flex-grow p-6 overflow-y-auto">
                {activeTab === 'controls' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">Settings</h2>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                                    <label htmlFor="dotModeToggle" className="font-medium text-gray-300">Dot Mode</label>
                                    <button
                                        id="dotModeToggle"
                                        role="switch"
                                        aria-checked={dotMode}
                                        onClick={() => onDotModeChange(!dotMode)}
                                        className={`${dotMode ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                    >
                                        <span className={`${dotMode ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}/>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                                    <div>
                                        <label htmlFor="startMarkerToggle" className="font-medium text-gray-300">Show Start Marker</label>
                                        <p className="text-xs text-gray-400 mt-1">Hide the initial point for a cleaner animation.</p>
                                    </div>
                                    <button
                                        id="startMarkerToggle"
                                        role="switch"
                                        aria-checked={showStartMarkers}
                                        onClick={() => onShowStartMarkersChange(!showStartMarkers)}
                                        className={`${showStartMarkers ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                    >
                                        <span className={`${showStartMarkers ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}/>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                                    <div>
                                        <label htmlFor="endMarkerToggle" className="font-medium text-gray-300">Show End Marker</label>
                                        <p className="text-xs text-gray-400 mt-1">Toggle the target marker for minimal end-state clutter.</p>
                                    </div>
                                    <button
                                        id="endMarkerToggle"
                                        role="switch"
                                        aria-checked={showEndMarkers}
                                        onClick={() => onShowEndMarkersChange(!showEndMarkers)}
                                        className={`${showEndMarkers ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                    >
                                        <span className={`${showEndMarkers ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}/>
                                    </button>
                                </div>
                                <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                                    <div>
                                        <label htmlFor="fadingPathToggle" className="font-medium text-gray-300">Fading Path</label>
                                        <p className="text-xs text-gray-400 mt-1">Leave a dynamic trailing glow instead of a full trace.</p>
                                    </div>
                                    <button
                                        id="fadingPathToggle"
                                        role="switch"
                                        aria-checked={fadingPath}
                                        onClick={() => onFadingPathToggle(!fadingPath)}
                                        className={`${fadingPath ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                    >
                                        <span className={`${fadingPath ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}/>
                                    </button>
                                </div>
                                {fadingPath && (
                                    <div className="space-y-3 bg-gray-800/60 border border-cyan-500/40 rounded-lg p-3">
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <label htmlFor="fadingLengthSlider" className="font-medium text-gray-200">Trail Length</label>
                                                <span className="text-sm text-cyan-300 font-mono">{fadingPathLength}</span>
                                            </div>
                                            <input
                                                id="fadingLengthSlider"
                                                type="range"
                                                min={10}
                                                max={400}
                                                step={10}
                                                value={Math.min(400, Math.max(10, Math.round(fadingPathLength)))}
                                                onChange={(e) => onFadingPathLengthChange(Math.max(2, Math.round(parseFloat(e.target.value))))}
                                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 mt-2"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between bg-gray-900/60 rounded-md px-3 py-2">
                                            <div>
                                                <label htmlFor="dynamicFadingToggle" className="font-medium text-gray-200">Dynamic</label>
                                                <p className="text-xs text-gray-400 mt-1">Tail responds to real-time motion and fades when idle.</p>
                                            </div>
                                            <button
                                                id="dynamicFadingToggle"
                                                role="switch"
                                                aria-checked={dynamicFadingPath}
                                                onClick={() => onDynamicFadingPathChange(!dynamicFadingPath)}
                                                className={`${dynamicFadingPath ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                            >
                                                <span className={`${dynamicFadingPath ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}/>
                                            </button>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-200 block mb-2">Trail Style</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onFadingPathStyleChange('smooth')}
                                                    className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                                                        fadingPathStyle === 'smooth'
                                                            ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/40'
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                >
                                                    Smooth Tail
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onFadingPathStyleChange('dots')}
                                                    className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                                                        fadingPathStyle === 'dots'
                                                            ? 'bg-cyan-500 text-gray-900 shadow-lg shadow-cyan-500/40'
                                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                    }`}
                                                >
                                                    Chopped Dots
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">Matrix A</h2>
                            <div className="p-3 bg-gray-900/50 rounded-lg">
                                <div className="mb-3 pb-3 border-b border-gray-700">
                                    <div className="flex items-center gap-4">
                                        <label htmlFor="presetSlider" className="text-sm font-medium text-gray-300 flex-shrink-0">Preset</label>
                                        <input
                                            id="presetSlider"
                                            type="range"
                                            min="0"
                                            max={sliderPresets.length - 1}
                                            step="1"
                                            value={currentSliderIndex === -1 ? lastSliderIndex : currentSliderIndex}
                                            onChange={(e) => {
                                                const newIndex = parseInt(e.target.value, 10);
                                                onPresetSelect(sliderPresets[newIndex].name);
                                            }}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        />
                                    </div>
                                    <div className="mt-3 flex gap-2">
                                        <select
                                            value={selectedPresetName}
                                            onChange={(e) => onPresetSelect(e.target.value)}
                                            className="flex-1 bg-gray-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                            {PRESET_MATRICES.map(preset => (
                                                <option key={preset.name} value={preset.name}>
                                                    {preset.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleRandomMatrix}
                                            className="bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold px-3 py-2 rounded transition-colors"
                                            type="button"
                                        >
                                            Random
                                        </button>
                                    </div>
                                    <p className="text-center text-cyan-400 font-medium text-xs mt-2">{selectedPresetName}</p>
                                    <div className="mt-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-gray-300">Scalar</label>
                                            <NumberInput
                                                value={matrixScalar}
                                                onChange={(v) => onMatrixScalarChange(v)}
                                                className="w-24"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium text-gray-300">Exponent</label>
                                            <NumberInput
                                                value={matrixExponent}
                                                onChange={(v) => onMatrixExponentChange(Math.max(1, Math.round(v || 1)))}
                                                step={1}
                                                min={1}
                                                className="w-24"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="normalizeToggle" className="text-sm font-medium text-gray-300">Normalize</label>
                                            <button
                                                id="normalizeToggle"
                                                role="switch"
                                                aria-checked={normalizeMatrix}
                                                onClick={() => onNormalizeToggle(!normalizeMatrix)}
                                                className={`${normalizeMatrix ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                            >
                                                <span className={`${normalizeMatrix ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label htmlFor="linearInterpolationToggle" className="text-sm font-medium text-gray-300">Linear Eigen Interp.</label>
                                            <button
                                                id="linearInterpolationToggle"
                                                role="switch"
                                                aria-checked={linearEigenInterpolation}
                                                onClick={() => onLinearInterpolationToggle(!linearEigenInterpolation)}
                                                className={`${linearEigenInterpolation ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                                type="button"
                                            >
                                                <span className={`${linearEigenInterpolation ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
                                            </button>
                                        </div>
                                        {normalizationWarning && (
                                            <p className="text-xs text-amber-300 bg-amber-900/30 border border-amber-500/40 rounded px-3 py-2">
                                                {normalizationWarning}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-3">
                                    {matrix.map((row, i) =>
                                        row.map((val, j) => (
                                            <NumberInput key={`${i}-${j}`} value={val} onChange={(v) => handleMatrixValueChange(i, j, v)} className="w-full" />
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h2 className="text-lg font-semibold text-gray-200">Initial Vectors</h2>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={onNormalizeVectors}
                                        className="bg-gray-700 hover:bg-gray-600 text-cyan-300 text-xs font-semibold py-1 px-2 rounded transition-colors duration-300"
                                        type="button"
                                    >
                                        Normalize
                                    </button>
                                    <button 
                                        onClick={onAddVector}
                                        className="bg-gray-700 hover:bg-gray-600 text-cyan-400 text-xs font-bold py-1 px-2 rounded transition-colors duration-300"
                                        type="button"
                                    >
                                        + ADD
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                               {vectors.map(vector => (
                                   <VectorControls
                                        key={vector.id}
                                        vector={vector}
                                        onVectorChange={onVectorChange}
                                        onVectorColorChange={onVectorColorChange}
                                        onRemoveVector={onRemoveVector}
                                        onToggleVisibility={onToggleVisibility}
                                   />
                               ))}
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">
                                Parameter t = {t.toFixed(getPrecisionSliderValue(tPrecision))}
                            </h2>
                            <div className="p-3 bg-gray-900/50 rounded-lg">
                                <div className="mb-4">
                                    <input
                                        type="range"
                                        min={animationConfig.startT}
                                        max={animationConfig.endT}
                                        step={tPrecision}
                                        value={t}
                                        onChange={(e) => onTChange(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                        disabled={isPlaying}
                                    />
                                </div>
                                <div className="flex flex-col gap-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-300">Min t</label>
                                        <NumberInput value={animationConfig.startT} onChange={handleStartTChange} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-300">Max t</label>
                                        <NumberInput value={animationConfig.endT} onChange={handleEndTChange} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label htmlFor="precisionSlider" className="text-sm font-medium text-gray-300">Step Precision</label>
                                        <span className="text-sm font-mono text-cyan-400">{tPrecision}</span>
                                    </div>
                                    <input
                                        id="precisionSlider"
                                        type="range"
                                        min="1"
                                        max="3"
                                        step="1"
                                        value={getPrecisionSliderValue(tPrecision)}
                                        onChange={(e) => handlePrecisionChange(parseInt(e.target.value, 10))}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 mt-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'animation' && (
                     <div className="space-y-6">
                         <div>
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">Preset Matrix</h2>
                            <select
                                value={selectedPresetName}
                                onChange={(e) => onPresetSelect(e.target.value)}
                                className="w-full bg-gray-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                {PRESET_MATRICES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                            </select>
                        </div>
                        
                        <div>
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">Activation Function</h2>
                            <div className="space-y-3 bg-gray-900/50 p-3 rounded-lg">
                                <select
                                    value={activationConfig.name}
                                    onChange={(e) => onActivationConfigChange({...activationConfig, name: e.target.value})}
                                    className="w-full bg-gray-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    {PRESET_ACTIVATION_FUNCTIONS.map(af => <option key={af.value} value={af.value}>{af.name}</option>)}
                                </select>
                                {activationConfig.name === 'custom' && (
                                    <div>
                                        <input
                                            type="text"
                                            value={activationConfig.customFnStr}
                                            onChange={(e) => onActivationConfigChange({...activationConfig, customFnStr: e.target.value})}
                                            placeholder="e.g. x^2 - 1"
                                            className="w-full bg-gray-700 text-white rounded p-2 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                        {activationConfig.error && <p className="text-red-400 text-xs mt-2">{activationConfig.error}</p>}
                                    </div>
                                )}
                            </div>
                        </div>

                         <div>
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">Animation Config</h2>
                            <div className="space-y-3 bg-gray-900/50 p-3 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <label className="text-gray-300">Start Time (t)</label>
                                    <NumberInput value={animationConfig.startT} onChange={v => onAnimationConfigChange({...animationConfig, startT: v, endT: Math.max(v, animationConfig.endT) })} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-gray-300">End Time (t)</label>
                                    <NumberInput value={animationConfig.endT} onChange={v => onAnimationConfigChange({...animationConfig, endT: Math.max(v, animationConfig.startT)})} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-gray-300">Duration (s)</label>
                                    <NumberInput value={animationConfig.duration} onChange={v => onAnimationConfigChange({...animationConfig, duration: Math.max(0.1, v)})} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-gray-300">Repeat (ping-pong)</label>
                                    <button
                                        role="switch"
                                        aria-checked={repeatAnimation}
                                        onClick={() => onRepeatToggle(!repeatAnimation)}
                                        className={`${repeatAnimation ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500`}
                                        type="button"
                                    >
                                        <span className={`${repeatAnimation ? 'translate-x-6' : 'translate-x-1'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
                                    </button>
                                </div>
                                 <div className="flex items-center justify-between">
                                     <label className="text-gray-300">Easing</label>
                                    <select
                                        value={animationConfig.easing}
                                        onChange={(e) => onAnimationConfigChange({...animationConfig, easing: e.target.value as keyof typeof easingFunctions})}
                                        className="w-1/2 bg-gray-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                    >
                                        {Object.keys(easingFunctions).map(name => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold mb-2 text-gray-200">Playback</h2>
                            <div className="bg-gray-900/50 p-3 rounded-lg space-y-3">
                                <div className="w-full bg-gray-600 rounded-full h-2.5">
                                    <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${((t - animationConfig.startT) / (animationConfig.endT - animationConfig.startT) || 0) * 100}%` }}></div>
                                </div>
                                <div className="flex justify-center items-center gap-4">
                                    <button onClick={onResetTime} aria-label="Reset Animation" className="p-3 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8.445 14.832A1 1 0 0010 14V6a1 1 0 00-1.555-.832L4.6 8.432A1 1 0 004 9.236v1.528a1 1 0 00.6-1.368l3.845-2.268-3.845 2.268A1 1 0 004 9.236v1.528a1 1 0 00.6.928l3.845 2.136z M12.555 5.168A1 1 0 0011 6v8a1 1 0 001.555.832l3.845-2.268A1 1 0 0017 11.764V9.236a1 1 0 00-.6-1.368L12.555 5.168z"/></svg>
                                    </button>
                                     <button onClick={onPlayPause} aria-label={isPlaying ? "Pause Animation" : "Play Animation"} className="p-4 text-white bg-cyan-600 hover:bg-cyan-500 rounded-full transition-colors text-2xl">
                                        {isPlaying ? 
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg> 
                                            : 
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>}
                                    </button>
                                    <div className="w-5 h-5"></div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'walls' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-200">Collision Walls</h2>
                            <button
                                onClick={onAddWall}
                                className="bg-gray-700 hover:bg-gray-600 text-cyan-400 text-xs font-bold py-1 px-2 rounded transition-colors duration-300"
                            >
                                + ADD
                            </button>
                        </div>
                        <div className="space-y-3">
                            {walls.length === 0 && (
                                <p className="text-sm text-gray-400 bg-gray-900/40 border border-gray-700 rounded-lg p-4">
                                    Add planes aligned to the global axes. Each wall reflects the plane defined by the chosen axis at the specified position.
                                </p>
                            )}
                            {walls.map(wall => (
                                <div key={wall.id} className="bg-gray-900/50 rounded-lg p-3 space-y-3 border border-gray-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-200">Wall #{wall.id.toString().slice(-4)}</span>
                                        <button
                                            onClick={() => onRemoveWall(wall.id)}
                                            className="text-xs text-red-400 hover:text-red-300"
                                            aria-label="Remove wall"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="text-sm font-medium text-gray-300">Axis</label>
                                        <select
                                            value={wall.axis}
                                            onChange={(e) => onUpdateWall(wall.id, { axis: e.target.value as Wall['axis'] })}
                                            className="flex-1 bg-gray-700 text-white rounded p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 uppercase"
                                        >
                                            <option value="x">x</option>
                                            <option value="y">y</option>
                                            <option value="z">z</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-300">Position</label>
                                        <NumberInput
                                            value={wall.position}
                                            onChange={(v) => onUpdateWall(wall.id, { position: v })}
                                            className="w-28"
                                            step={0.1}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {`Plane: ${wall.axis.toUpperCase()} = ${wall.position.toFixed(2)}`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 pt-2">
                {error && (
                    <div className="p-3 bg-red-900 border border-red-700 rounded-lg">
                        <p className="text-red-300 font-semibold">Error</p>
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}
                
                <div className="mt-4 text-xs text-center text-gray-500">
                    <p>Use your mouse to rotate, pan, and zoom the 3D view.</p>
                </div>
            </div>
        </div>
    );
};

export default ControlsPanel;
