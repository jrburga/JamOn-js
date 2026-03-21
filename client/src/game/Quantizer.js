/**
 * Quantizer.js — Direct port of quantizer.py
 *
 * Snaps recorded note times to the nearest beat-grid position.
 */
export class Quantizer {
  /**
   * @param {number} seconds - Total phrase length in seconds
   * @param {number} res     - Number of discrete grid divisions per phrase
   */
  constructor(seconds, res) {
    this.seconds = seconds;
    this.res = res;
    this.spn = seconds / res; // seconds per note (grid size)
  }

  /** Snap a time value to the nearest grid position. */
  quantizeNote(time) {
    const offset = time % this.spn;
    if (offset < this.spn / 2) {
      return time - offset;
    } else {
      return time - offset + this.spn;
    }
  }

  /**
   * Quantize a gem (note with start time and length).
   * @param {{ time: number, length: number }} gem - Mutated in place.
   */
  quantizeGem(gem) {
    const newStart = this.quantizeNote(gem.time);
    const newEnd = this.quantizeNote(gem.time + gem.length);
    let newLength = newEnd - newStart;

    // If note was too short, snap to minimum grid size
    if (newLength < this.spn) {
      newLength = this.spn;
    }

    gem.time = newStart;
    gem.length = newLength;
  }

  /** Quantize a percussive (drum) gem — only start time, no length. */
  quantizeDrumGem(gem) {
    gem.time = this.quantizeNote(gem.time);
  }
}
