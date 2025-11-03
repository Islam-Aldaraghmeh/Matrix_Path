import type { Matrix3, Vector3, VectorObject, Wall, FadingPathStyle } from '../types';

export interface AnimationConfigSnapshot {
    duration: number;
    startT: number;
    endT: number;
    easing: string;
}

export interface ActivationSnapshot {
    name: string;
    customFnStr: string;
}

export interface ProfileData {
    version: number;
    matrixA: Matrix3;
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
    animationConfig: AnimationConfigSnapshot;
    repeatAnimation: boolean;
    activation: ActivationSnapshot;
    selectedPresetName: string;
    matrixScalar: number;
    matrixExponent: number;
    normalizeMatrix: boolean;
    linearEigenInterpolation: boolean;
}

export interface ProfileSummary {
    name: string;
    updatedAt: number;
}

export interface StoredProfile extends ProfileSummary {
    data: ProfileData;
}

export type SaveResult = 'created' | 'updated';
export type OperationStatus = 'success' | 'error' | 'info';

export interface ProfileOperationResult {
    success: boolean;
    status: OperationStatus;
    message: string;
}

const PROFILE_KEY = 'mtv.profiles.v1';
const LAST_SESSION_KEY = 'mtv.last_session.v1';
const LAST_USED_KEY = 'mtv.last_used_profile.v1';

const PROFILE_VERSION = 1;

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParseJSON = <T>(value: string | null): T | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch (error) {
        console.warn('Failed to parse stored profile data', error);
        return null;
    }
};

const readProfilesMap = (): Record<string, StoredProfile> => {
    if (!isBrowser) return {};
    const parsed = safeParseJSON<Record<string, StoredProfile>>(window.localStorage.getItem(PROFILE_KEY));
    if (!parsed || typeof parsed !== 'object') {
        return {};
    }
    return parsed;
};

const writeProfilesMap = (map: Record<string, StoredProfile>) => {
    if (!isBrowser) return;
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(map));
};

export const listProfiles = (): ProfileSummary[] => {
    const map = readProfilesMap();
    return Object.values(map)
        .map(profile => ({ name: profile.name, updatedAt: profile.updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const loadProfile = (name: string): ProfileData | null => {
    const map = readProfilesMap();
    const entry = map[name];
    if (!entry) return null;
    return entry.data;
};

export const saveProfile = (name: string, data: ProfileData): SaveResult => {
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new Error('Profile name must be non-empty');
    }
    if (!isBrowser) {
        console.warn('Attempted to save profile outside browser context');
        return 'created';
    }
    const map = readProfilesMap();
    const exists = Boolean(map[trimmedName]);
    map[trimmedName] = {
        name: trimmedName,
        updatedAt: Date.now(),
        data: { ...data, version: PROFILE_VERSION }
    };
    writeProfilesMap(map);
    return exists ? 'updated' : 'created';
};

export const deleteProfile = (name: string): boolean => {
    if (!name) return false;
    if (!isBrowser) return false;
    const map = readProfilesMap();
    if (!map[name]) {
        return false;
    }
    delete map[name];
    writeProfilesMap(map);
    return true;
};

export const loadLastSession = (): ProfileData | null => {
    if (!isBrowser) return null;
    return safeParseJSON<ProfileData>(window.localStorage.getItem(LAST_SESSION_KEY));
};

export const saveLastSession = (data: ProfileData) => {
    if (!isBrowser) return;
    window.localStorage.setItem(LAST_SESSION_KEY, JSON.stringify({ ...data, version: PROFILE_VERSION }));
};

export const loadLastUsedProfile = (): string | null => {
    if (!isBrowser) return null;
    const value = window.localStorage.getItem(LAST_USED_KEY);
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    return null;
};

export const saveLastUsedProfile = (name: string | null) => {
    if (!isBrowser) return;
    if (name && name.trim().length > 0) {
        window.localStorage.setItem(LAST_USED_KEY, name.trim());
    } else {
        window.localStorage.removeItem(LAST_USED_KEY);
    }
};

export const getProfileVersion = () => PROFILE_VERSION;
