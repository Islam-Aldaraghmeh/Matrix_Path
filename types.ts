export type Matrix3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number]
];

export type Vector3 = [number, number, number];

export interface VectorObject {
  id: number;
  value: Vector3;
  visible: boolean;
  color: string;
}

export type WallAxis = 'x' | 'y' | 'z';

export interface Wall {
  id: number;
  axis: WallAxis;
  position: number;
}

export type FadingPathStyle = 'smooth' | 'dots';
