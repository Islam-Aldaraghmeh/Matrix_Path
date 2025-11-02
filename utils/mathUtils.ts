import * as math from 'mathjs';
import type { Matrix3, Vector3 } from '../types';
import type { ActivationFunction } from './activationFunctions';

export const toReal = (val: number | math.Complex): number => {
    if (typeof val === 'object' && val !== null && 're' in val) {
        return (val as math.Complex).re;
    }
    return val as number;
};

export interface TransformOptions {
    linearEigenInterpolation?: boolean;
}

export const interpolateEigenvalue = (
    value: number | math.Complex,
    t: number,
    options?: TransformOptions
): number | math.Complex => {
    if (options?.linearEigenInterpolation) {
        // Linear interpolation between 1 and the eigenvalue: (1 - t) + t * value
        return math.add(
            math.multiply(value, t),
            math.multiply(1 - t, 1)
        ) as number | math.Complex;
    }
    return math.pow(value, t) as number | math.Complex;
};

export const multiplyMatrixVector = (matrix: Matrix3, vector: Vector3): Vector3 => {
    const [x, y, z] = vector;
    return [
        matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z,
        matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z,
        matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z,
    ];
};

const optionKey = (options?: TransformOptions): string =>
    options?.linearEigenInterpolation ? 'linear' : 'pow';

const timeKey = (t: number): number => (Number.isFinite(t) ? Number(t.toFixed(6)) : NaN);

export interface MatrixEvaluator {
    eigenValues: (number | math.Complex)[];
    getMatrixAt: (t: number, options?: TransformOptions) => Matrix3 | null;
    applyToVector: (t: number, v: Vector3, options?: TransformOptions) => Vector3 | null;
}

export function createMatrixEvaluator(A: Matrix3): MatrixEvaluator | null {
    try {
        const matA = math.matrix(A);
        const eigs = math.eigs(matA);

        if (!eigs.values || !eigs.eigenvectors) {
            return null;
        }

        const eigenValues = math.matrix(eigs.values).toArray() as (number | math.Complex)[];
        const eigenvectorArrays = eigs.eigenvectors.map((e: any) => e.vector);
        const P = math.transpose(math.matrix(eigenvectorArrays));
        const Pinv = math.inv(P);

        const cache = new Map<string, Map<number, Matrix3>>();

        const getOrCreateMatrix = (t: number, options?: TransformOptions): Matrix3 | null => {
            const k = optionKey(options);
            const optionCache = cache.get(k) ?? new Map<number, Matrix3>();
            if (!cache.has(k)) {
                cache.set(k, optionCache);
            }
            const tKey = timeKey(t);
            if (!Number.isFinite(tKey)) {
                return null;
            }
            if (optionCache.has(tKey)) {
                return optionCache.get(tKey)!;
            }

            const diagValues = eigenValues.map(lambda => interpolateEigenvalue(lambda, t, options));
            const Dt = math.diag(diagValues);
            const At = math.multiply(math.multiply(P, Dt), Pinv) as math.Matrix;

            if (!At || typeof At.toArray !== 'function') {
                return null;
            }
            const resultArray = At.toArray() as (number | math.Complex)[][];
            const realMatrix = resultArray.map(row => row.map(toReal)) as Matrix3;
            optionCache.set(tKey, realMatrix);
            return realMatrix;
        };

        const applyToVector = (t: number, v: Vector3, options?: TransformOptions): Vector3 | null => {
            const mat = getOrCreateMatrix(t, options);
            if (!mat) {
                return null;
            }
            return multiplyMatrixVector(mat, v);
        };

        return {
            eigenValues,
            getMatrixAt: getOrCreateMatrix,
            applyToVector,
        };
    } catch (error) {
        console.error('Matrix evaluator error:', error);
        return null;
    }
}

export function calculateAt(A: Matrix3, t: number, options: TransformOptions = {}): Matrix3 | null {
    const evaluator = createMatrixEvaluator(A);
    return evaluator ? evaluator.getMatrixAt(t, options) : null;
}

export function calculateAtvRaw(
    A: Matrix3,
    v: Vector3,
    t: number,
    options: TransformOptions = {}
): Vector3 | null {
    const evaluator = createMatrixEvaluator(A);
    return evaluator ? evaluator.applyToVector(t, v, options) : null;
}

export function calculateAtv(
    A: Matrix3,
    v: Vector3,
    t: number,
    activationFn: ActivationFunction,
    options: TransformOptions = {}
): Vector3 | null {
    const evaluator = createMatrixEvaluator(A);
    if (!evaluator) return null;
    const raw = evaluator.applyToVector(t, v, options);
    if (!raw) return null;
    return raw.map(activationFn) as Vector3;
}
