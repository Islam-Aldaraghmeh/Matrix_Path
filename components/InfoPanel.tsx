import React from 'react';
import type { Matrix3, Vector3, Wall } from '../types';

interface InfoPanelProps {
    baseMatrix: Matrix3;
    effectiveMatrix: Matrix3 | null;
    matrixScalar: number;
    matrixExponent: number;
    normalizeRequested: boolean;
    normalizeApplied: boolean;
    determinantBefore: number | null;
    determinantAfter: number | null;
    normalizationWarning: string | null;
    walls: Wall[];
    wallContactCounts: Record<number, number>;
    eigenvalues: { re: number; im: number }[] | null;
    eigenvaluesAtT: { re: number; im: number }[] | null;
    matrixAt: Matrix3 | null;
    determinantAtT: number | null;
    vectorV: Vector3 | null;
    rawTransformedV: Vector3 | null;
    transformedV: Vector3 | null;
    activationFnName: string;
    customActivationFnStr: string;
}

const formatNum = (n: number | undefined) => (n !== undefined && isFinite(n) ? n.toFixed(2).padStart(7, ' ') : '  -    ');

const formatVector = (v: Vector3 | null): string => {
    if (!v) return `[${formatNum(undefined)},${formatNum(undefined)},${formatNum(undefined)}]`;
    return `[${formatNum(v[0])},${formatNum(v[1])},${formatNum(v[2])}]`;
};

const formatMatrix = (m: Matrix3 | null): string => {
    if (!m) {
         const loadingRow = `| ${formatVector(null)} |`;
         return `${loadingRow}\n${loadingRow}\n${loadingRow}`;
    }
    return m.map(row => `|${formatNum(row[0])},${formatNum(row[1])},${formatNum(row[2])}|`).join('\n');
};

const formatScalar = (value: number): string => {
    if (!Number.isFinite(value)) return '—';
    return value.toFixed(2);
};

const formatDeterminant = (value: number | null): string => {
    if (value === null || !Number.isFinite(value)) return '—';
    return value.toFixed(3);
};

const formatEigenvalue = (value: { re: number; im: number }): string => {
    const hasReal = Number.isFinite(value.re);
    const hasImag = Number.isFinite(value.im) && Math.abs(value.im) > 1e-6;

    const realPart = hasReal ? value.re.toFixed(3) : '—';
    if (!hasImag) {
        return realPart;
    }

    const imagMagnitude = Math.abs(value.im).toFixed(3);
    const sign = value.im >= 0 ? '+' : '-';
    return `${realPart} ${sign} ${imagMagnitude}i`;
};

const InfoPanel: React.FC<InfoPanelProps> = ({
    baseMatrix,
    effectiveMatrix,
    matrixScalar,
    matrixExponent,
    normalizeRequested,
    normalizeApplied,
    determinantBefore,
    determinantAfter,
    normalizationWarning,
    walls,
    wallContactCounts,
    eigenvalues,
    eigenvaluesAtT,
    matrixAt,
    determinantAtT,
    vectorV,
    rawTransformedV,
    transformedV,
    activationFnName,
    customActivationFnStr
}) => {
    const activationDisplay = activationFnName.toLowerCase() === 'custom' 
        ? `f(x) = ${customActivationFnStr || 'x'}`
        : `f(x) = ${activationFnName}`;

    const normalizationStatus = normalizeApplied
        ? `on (det → ${formatDeterminant(determinantAfter)})`
        : normalizeRequested
            ? `requested (det ≈ ${formatDeterminant(determinantBefore)}; pending)`
            : normalizationWarning
                ? `off (det ≈ ${formatDeterminant(determinantBefore)}; unavailable)`
                : 'off';

    const wallsSummary = walls.length === 0
        ? 'none'
        : walls.map(wall => {
            const hits = wallContactCounts[wall.id] ?? 0;
            const hitLabel = hits > 0 ? ` • contact: ${hits}` : '';
            return `${wall.axis.toUpperCase()} = ${wall.position.toFixed(2)}${hitLabel}`;
        }).join('\n');

    const eigenvaluesSummary = !eigenvalues || eigenvalues.length === 0
        ? '—'
        : eigenvalues.map((value, index) => `λ${index + 1}: ${formatEigenvalue(value)}`).join('\n');

    const eigenvaluesAtTSummary = !eigenvaluesAtT || eigenvaluesAtT.length === 0
        ? '—'
        : eigenvaluesAtT.map((value, index) => `λ${index + 1}: ${formatEigenvalue(value)}`).join('\n');

    return (
        <div className="absolute top-4 right-4 bg-gray-900/70 backdrop-blur-sm text-white p-4 rounded-lg shadow-lg font-mono text-xs border border-gray-700 pointer-events-auto">
            <div className="mb-3">
                <p className="text-cyan-400">A (base input):</p>
                <pre className="text-gray-300">{formatMatrix(baseMatrix)}</pre>
            </div>
            <div className="mb-3">
                <p className="text-cyan-400">A (effective):</p>
                <pre className="text-gray-300">{formatMatrix(effectiveMatrix)}</pre>
            </div>
            <div className="mb-3">
                <p className="text-cyan-400">Eigenvalues (A):</p>
                <pre className="text-gray-300 whitespace-pre-wrap">{eigenvaluesSummary}</pre>
            </div>
            <div className="mb-3">
                <p className="text-cyan-400">Eigenvalues (A<sup>t</sup>):</p>
                <pre className="text-gray-300 whitespace-pre-wrap">{eigenvaluesAtTSummary}</pre>
            </div>
            <div className="mb-3 space-y-1">
                <p className="text-cyan-400">Adjustments:</p>
                <p className="text-gray-300">scalar: {formatScalar(matrixScalar)}</p>
                <p className="text-gray-300">exponent: {matrixExponent}</p>
                <p className="text-gray-300">normalize: {normalizationStatus}</p>
                <p className="text-gray-500">det (pre-normalize): {formatDeterminant(determinantBefore)}</p>
                {normalizationWarning && (
                    <p className="text-amber-300">⚠ {normalizationWarning}</p>
                )}
            </div>
            <div className="mb-3">
                <p className="text-cyan-400">Walls:</p>
                <pre className="text-gray-300 whitespace-pre-wrap">{wallsSummary}</pre>
            </div>
            <div className="mb-3">
                <p className="text-cyan-400">A<sup>t</sup>:</p>
                <pre className="text-gray-300">{formatMatrix(matrixAt)}</pre>
                <p className="text-gray-500 mt-1">det(A<sup>t</sup>): {formatDeterminant(determinantAtT)}</p>
            </div>
            <div className="mb-3">
                <p className="text-cyan-400">v (first visible):</p>
                <pre className="text-gray-300">{formatVector(vectorV)}</pre>
            </div>
            <div className="mb-3">
                <p className="text-cyan-400">A<sup>t</sup>v:</p>
                <pre className="text-gray-300">{formatVector(rawTransformedV)}</pre>
            </div>
             <div className="mb-3">
                <p className="text-cyan-400">f(A<sup>t</sup>v):</p>
                <pre className="text-gray-300">{formatVector(transformedV)}</pre>
            </div>
            <div>
                 <p className="text-cyan-400">Activation:</p>
                 <pre className="text-gray-300">{activationDisplay}</pre>
            </div>
        </div>
    );
};

export default InfoPanel;
