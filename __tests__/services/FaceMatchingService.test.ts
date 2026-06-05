import {cosineSimilarity, l2Normalize} from '../../src/utils/cosineDistance';
import FaceMatchingService from '../../src/services/FaceMatchingService';

// ─── cosineSimilarity unit tests ────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const v = new Float32Array([1, 0, 0, 0]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  it('returns -1.0 for opposite vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('handles zero vector gracefully', () => {
    const a = new Float32Array([0, 0, 0]);
    const b = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('throws on mismatched dimensions', () => {
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([1, 2, 3]);
    expect(() => cosineSimilarity(a, b)).toThrow();
  });

  it('correctly computes similarity for 192-dim vectors', () => {
    const a = new Float32Array(192).fill(1 / Math.sqrt(192));
    const b = new Float32Array(192).fill(1 / Math.sqrt(192));
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 4);
  });
});

// ─── matchEmployee unit tests ────────────────────────────────────────────────

describe('FaceMatchingService.matchEmployee', () => {
  const service = FaceMatchingService.getInstance();

  function makeNormalizedVector(seed: number): Float32Array {
    const v = new Float32Array(192);
    for (let i = 0; i < 192; i++) {
      v[i] = Math.sin(seed + i);
    }
    return l2Normalize(v);
  }

  it('returns employee for perfect match (similarity 1.0)', () => {
    const probe = makeNormalizedVector(1);
    const candidates = [
      {employeeId: 'emp-1', embeddings: [probe]},
    ];
    const result = service.matchEmployee(probe, candidates);
    expect(result).not.toBeNull();
    expect(result?.employeeId).toBe('emp-1');
    expect(result?.similarity).toBeCloseTo(1.0, 4);
  });

  it('returns null when best similarity is below threshold (0.74)', () => {
    const probe = new Float32Array(192).fill(1 / Math.sqrt(192));
    // Create an orthogonal-ish vector
    const stored = new Float32Array(192);
    for (let i = 0; i < 192; i++) {
      stored[i] = i < 96 ? 1 / Math.sqrt(96) : 0;
    }
    const candidates = [
      {employeeId: 'emp-2', embeddings: [stored]},
    ];
    const result = service.matchEmployee(probe, candidates);
    // Similarity will be ~0.707 (below 0.75)
    expect(result).toBeNull();
  });

  it('returns highest-similarity employee from multiple candidates', () => {
    const probe = makeNormalizedVector(5);
    const candidates = [
      {employeeId: 'emp-A', embeddings: [makeNormalizedVector(100)]}, // distant
      {employeeId: 'emp-B', embeddings: [probe]},                      // perfect match
      {employeeId: 'emp-C', embeddings: [makeNormalizedVector(200)]}, // distant
    ];
    const result = service.matchEmployee(probe, candidates);
    expect(result?.employeeId).toBe('emp-B');
  });

  it('returns null for empty candidates array', () => {
    const probe = makeNormalizedVector(1);
    const result = service.matchEmployee(probe, []);
    expect(result).toBeNull();
  });

  it('assigns HIGH confidence for similarity >= 0.90', () => {
    const probe = makeNormalizedVector(7);
    const candidates = [{employeeId: 'emp-high', embeddings: [probe]}];
    const result = service.matchEmployee(probe, candidates);
    expect(result?.confidence).toBe('HIGH');
  });

  it('takes max similarity across all stored angles for one employee', () => {
    const probe = makeNormalizedVector(3);
    const badEmbedding = makeNormalizedVector(99);   // Far away
    const goodEmbedding = probe;                      // Perfect match

    const candidates = [
      {
        employeeId: 'emp-multi',
        embeddings: [badEmbedding, badEmbedding, goodEmbedding, badEmbedding],
      },
    ];
    const result = service.matchEmployee(probe, candidates);
    expect(result).not.toBeNull();
    expect(result?.similarity).toBeCloseTo(1.0, 4);
  });
});
