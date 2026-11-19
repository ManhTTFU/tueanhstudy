/**
 * AnimationController – điều khiển hiệu ứng pháo hoa (canvas-confetti).
 * Tôn trọng tuỳ chọn "giảm chuyển động": khi bật, không bắn pháo hoa.
 */
import confetti from 'canvas-confetti';

const COLORS = ['#FFD23F', '#FF7BAC', '#5BBCFF', '#4FD08F', '#A07BFF', '#FF9E66'];

class AnimationControllerImpl {
  private reduced = false;
  private timers: number[] = [];

  setReducedMotion(reduced: boolean) {
    this.reduced = reduced;
    if (reduced) this.stop();
  }

  isReduced() {
    return this.reduced;
  }

  /** Pháo hoa nhỏ khi trả lời đúng. */
  smallBurst(origin: { x: number; y: number } = { x: 0.5, y: 0.6 }) {
    if (this.reduced) return;
    void confetti({
      particleCount: 45,
      spread: 70,
      startVelocity: 32,
      scalar: 0.9,
      ticks: 120,
      origin,
      colors: COLORS,
      disableForReducedMotion: true,
    });
  }

  /** Pháo hoa lớn toàn màn hình khi đạt 10/10. */
  bigCelebration(durationMs = 2600) {
    if (this.reduced) return;
    this.stop();
    const end = Date.now() + durationMs;
    const frame = () => {
      void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
      void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
      if (Date.now() < end) this.timers.push(window.setTimeout(frame, 40));
    };
    frame();
    void confetti({
      particleCount: 160,
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.45 },
      shapes: ['circle', 'square', 'star'],
      colors: COLORS,
      disableForReducedMotion: true,
    });
  }

  stop() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    confetti.reset();
  }
}

export const AnimationController = new AnimationControllerImpl();
