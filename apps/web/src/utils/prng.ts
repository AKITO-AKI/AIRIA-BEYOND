/**
 * Seeded Pseudo-Random Number Generator (PRNG)
 * 
 * Uses a simple linear congruential generator (LCG) algorithm
 * to provide deterministic random numbers for reproducible image generation.
 */

export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  /**
   * Returns a pseudo-random number between 0 (inclusive) and 1 (exclusive)
   */
  next(): number {
    // Linear Congruential Generator (LCG)
    // Using parameters from Numerical Recipes
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /**
   * Returns a pseudo-random integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  /**
   * Returns a pseudo-random number between min (inclusive) and max (exclusive)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Returns true with probability p (0 to 1)
   */
  nextBoolean(p: number = 0.5): boolean {
    return this.next() < p;
  }
}
