export function calculateCoverage(sliceCount: number, sliceThickness: number, sliceGap: number): number {
  return sliceCount * sliceThickness + (sliceCount - 1) * sliceGap;
}
