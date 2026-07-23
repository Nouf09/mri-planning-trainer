/**
 * Builds minimal NIfTI-1 volumes for adapter integration tests.
 *
 * Test support only. The sform is written directly, so a test can craft
 * translated, anisotropic, permuted and negative-determinant affines and prove
 * the adapter samples the correct anatomical voxel rather than a nearby one.
 */

export interface NiftiSpec {
  /** Native voxel counts (x, y, z). Deliberately unequal in tests. */
  readonly dims: readonly [number, number, number];
  /** sform rows srow_x, srow_y, srow_z, each [a, b, c, translation]. */
  readonly srow: readonly [
    readonly [number, number, number, number],
    readonly [number, number, number, number],
    readonly [number, number, number, number],
  ];
  readonly sclSlope?: number;
  readonly sclInter?: number;
  /** Stored (pre-scaling) value at each native voxel. */
  readonly valueAt: (x: number, y: number, z: number) => number;
}

const HEADER_BYTES = 352;

/** Encodes native voxel position so a decoded sample reveals any axis error. */
export function encodeNativeCoordinate(x: number, y: number, z: number): number {
  return x * 10000 + y * 100 + z;
}

export function decodeNativeCoordinate(value: number): { x: number; y: number; z: number } {
  const x = Math.floor(value / 10000);
  const y = Math.floor((value - x * 10000) / 100);
  const z = value - x * 10000 - y * 100;
  return { x, y, z };
}

/** Millimetre position of a native voxel centre under the spec's sform. */
export function niftiVoxelToWorld(
  spec: NiftiSpec,
  x: number,
  y: number,
  z: number
): { x: number; y: number; z: number } {
  const [rx, ry, rz] = spec.srow;
  return {
    x: rx[0] * x + rx[1] * y + rx[2] * z + rx[3],
    y: ry[0] * x + ry[1] * y + ry[2] * z + ry[3],
    z: rz[0] * x + rz[1] * y + rz[2] * z + rz[3],
  };
}

/** A float32 NIfTI-1 volume as an ArrayBuffer, ready for NVImage. */
export function buildNiftiBuffer(spec: NiftiSpec): ArrayBuffer {
  const [nx, ny, nz] = spec.dims;
  const buffer = new ArrayBuffer(HEADER_BYTES + nx * ny * nz * 4);
  const dv = new DataView(buffer);

  dv.setInt32(0, 348, true);
  dv.setInt16(40, 3, true);
  dv.setInt16(42, nx, true);
  dv.setInt16(44, ny, true);
  dv.setInt16(46, nz, true);
  dv.setInt16(48, 1, true);
  dv.setInt16(50, 1, true);
  dv.setInt16(52, 1, true);
  dv.setInt16(70, 16, true); // DT_FLOAT32
  dv.setInt16(72, 32, true); // bitpix

  // pixdim: magnitude of each sform column, so Niivue's spacing is consistent.
  const colLen = (i: number) => Math.hypot(spec.srow[0][i], spec.srow[1][i], spec.srow[2][i]);
  dv.setFloat32(76, 1, true);
  dv.setFloat32(80, colLen(0), true);
  dv.setFloat32(84, colLen(1), true);
  dv.setFloat32(88, colLen(2), true);

  dv.setFloat32(108, HEADER_BYTES, true); // vox_offset
  dv.setFloat32(112, spec.sclSlope ?? 1, true);
  dv.setFloat32(116, spec.sclInter ?? 0, true);

  dv.setInt16(252, 0, true); // qform_code
  dv.setInt16(254, 1, true); // sform_code

  const [rx, ry, rz] = spec.srow;
  dv.setFloat32(280, rx[0], true); dv.setFloat32(284, rx[1], true); dv.setFloat32(288, rx[2], true); dv.setFloat32(292, rx[3], true);
  dv.setFloat32(296, ry[0], true); dv.setFloat32(300, ry[1], true); dv.setFloat32(304, ry[2], true); dv.setFloat32(308, ry[3], true);
  dv.setFloat32(312, rz[0], true); dv.setFloat32(316, rz[1], true); dv.setFloat32(320, rz[2], true); dv.setFloat32(324, rz[3], true);

  // magic "n+1\0"
  dv.setUint8(344, 0x6e);
  dv.setUint8(345, 0x2b);
  dv.setUint8(346, 0x31);
  dv.setUint8(347, 0);

  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const offset = HEADER_BYTES + (x + y * nx + z * nx * ny) * 4;
        dv.setFloat32(offset, spec.valueAt(x, y, z), true);
      }
    }
  }

  return buffer;
}
