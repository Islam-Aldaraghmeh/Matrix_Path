import * as math from 'mathjs';

export type ActivationFunction = (n: number) => number;

export const activationFunctionMap: { [key: string]: ActivationFunction } = {
    identity: (x) => x,
    relu: (x) => Math.max(0, x),
    sigmoid: (x) => 1 / (1 + Math.exp(-x)),
    tanh: (x) => Math.tanh(x),
    leakyRelu: (x) => Math.max(0.1 * x, x),
    elu: (x) => (x >= 0 ? x : 1.0 * (Math.exp(x) - 1)),
};

export const PRESET_ACTIVATION_FUNCTIONS = [
    { name: 'Identity', value: 'identity' },
    { name: 'ReLU', value: 'relu' },
    { name: 'Sigmoid', value: 'sigmoid' },
    { name: 'Tanh', value: 'tanh' },
    { name: 'Leaky ReLU', value: 'leakyRelu' },
    { name: 'ELU', value: 'elu' },
    { name: 'Custom', value: 'custom' },
];

export function parseCustomActivation(
    expression: string
): { fn: ActivationFunction | null; error: string | null } {
    if (!expression.trim()) {
        return { fn: (x) => x, error: null }; // Default to identity if empty
    }
    try {
        const node = math.parse(expression);
        const code = node.compile();
        
        const fn = (x: number): number => {
            try {
                const result = code.evaluate({ x });
                if (typeof result !== 'number' || !isFinite(result)) {
                    return NaN;
                }
                return result;
            } catch (evalError) {
                console.error('Custom function evaluation error:', evalError);
                return NaN;
            }
        };

        // Test with a value to ensure it's a valid function of x
        const testResult = fn(1);
        if (typeof testResult !== 'number' || isNaN(testResult)) {
           throw new Error("Function did not return a valid number. Ensure you use 'x' as the variable.");
        }

        return { fn, error: null };
    } catch (e: any) {
        return { fn: null, error: e.message || 'Invalid expression' };
    }
}
