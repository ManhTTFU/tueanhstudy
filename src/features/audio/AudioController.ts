/**
 * AudioController – phát giọng đọc & hiệu ứng âm thanh lưu trong dự án.
 *  - Giọng đọc (.m4a) phát lần lượt, câu mới ngắt câu cũ (không chồng tiếng).
 *  - Hiệu ứng (.wav) phát song song.
 *  - Nếu thiếu file giọng đọc => dùng Web Speech API tiếng Việt (nếu có).
 *  - Tắt âm thanh => không phát gì cả.
 */
import { numberWord } from '../../data/numbers/numbers';
import type { VoiceLine } from '../../data/voice';

export type SfxName = 'correct' | 'wrong' | 'candy' | 'gift' | 'celebrate' | 'tap' | 'pop' | 'flip';

const SFX_VOLUME: Record<SfxName, number> = {
  correct: 0.7,
  wrong: 0.5,
  candy: 0.7,
  gift: 0.8,
  celebrate: 0.8,
  tap: 0.4,
  pop: 0.5,
  flip: 0.4,
};

class AudioControllerImpl {
  private enabled = true;
  private voice: HTMLAudioElement | null = null;
  private cache = new Map<string, HTMLAudioElement>();
  private voiceToken = 0;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stopVoice();
  }

  isEnabled() {
    return this.enabled;
  }

  private element(src: string): HTMLAudioElement {
    let el = this.cache.get(src);
    if (!el) {
      el = new Audio(src);
      el.preload = 'auto';
      this.cache.set(src, el);
    }
    return el;
  }

  /** Tải trước để phát tức thì (gọi khi vào màn chơi). */
  preload(paths: string[]) {
    for (const p of paths) this.element(p);
  }

  sfx(name: SfxName) {
    if (!this.enabled) return;
    const src = `/assets/sounds/sfx/${name}.wav`;
    const base = this.element(src);
    // Clone để cùng một hiệu ứng có thể phát chồng nhau (ví dụ bé chạm nhanh).
    const el = base.paused ? base : (base.cloneNode() as HTMLAudioElement);
    el.volume = SFX_VOLUME[name];
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  }

  /** Phát một câu thoại. Trả về Promise kết thúc khi đọc xong (hoặc bị ngắt). */
  speak(line: VoiceLine): Promise<void> {
    if (!this.enabled) return Promise.resolve();
    this.stopVoice();
    // Không có file ghi âm (vd. đề bài nhóm 5–9 tuổi sinh ngẫu nhiên): dùng giọng đọc hệ thống.
    if (!line.file) {
      this.speakWithSystemVoice(line.text);
      return Promise.resolve();
    }
    const token = ++this.voiceToken;
    const el = this.element(`/assets/sounds/${line.file}.m4a`);
    this.voice = el;
    el.currentTime = 0;
    el.volume = 1;
    return new Promise<void>((resolve) => {
      const done = () => {
        el.removeEventListener('ended', done);
        el.removeEventListener('pause', done);
        resolve();
      };
      el.addEventListener('ended', done);
      el.addEventListener('pause', done);
      el.play().catch(() => {
        done();
        // Trình duyệt chặn tự phát hoặc thiếu file => thử giọng đọc hệ thống.
        if (token === this.voiceToken) this.speakWithSystemVoice(line.text);
      });
    });
  }

  speakNumber(n: number) {
    return this.speak({ file: `numbers/${n}`, text: numberWord(n) });
  }

  stopVoice() {
    this.voiceToken++;
    if (this.voice && !this.voice.paused) this.voice.pause();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  private speakWithSystemVoice(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const vi = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));
    if (!vi) return; // không có giọng tiếng Việt thì im lặng còn hơn đọc sai
    const u = new SpeechSynthesisUtterance(text);
    u.voice = vi;
    u.lang = vi.lang;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }
}

export const AudioController = new AudioControllerImpl();
