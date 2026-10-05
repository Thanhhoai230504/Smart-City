import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './homeStyle';

/**
 * `true` khi phần tử đã vào khung nhìn. `once` (mặc định) thì giữ `true` mãi —
 * cho hiệu ứng xuất hiện; `once: false` thì theo dõi liên tục — cho hoạt cảnh
 * chỉ nên chạy khi đang nhìn thấy.
 */
export function useInView<T extends Element>({ threshold = 0.18, once = true } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        if (once) observer.disconnect();
      } else if (!once) {
        setInView(false);
      }
    }, { threshold });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, once]);

  return [ref, inView] as const;
}

/** Số chạy từ 0 lên `target` (easeOutCubic) khi `run` bật — giảm chuyển động thì hiện ngay. */
export function useCountUp(target: number | null, run: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target == null || !run) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, run, duration]);

  return value;
}

/** Đợi font của chữ ĐÀ NẴNG tải xong (tối đa `timeoutMs`) để chữ không nhảy từ font dự phòng sang. */
export function useFontReady(font: string, sample: string, timeoutMs = 1200) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const done = () => { if (alive) setReady(true); };
    const timer = window.setTimeout(done, timeoutMs);
    if (typeof document !== 'undefined' && document.fonts?.load) {
      document.fonts.load(font, sample).then(done, done);
    } else {
      done();
    }
    return () => { alive = false; window.clearTimeout(timer); };
  }, [font, sample, timeoutMs]);

  return ready;
}

/** Chuyển cảnh "tan cát" giữa hai hình minh hoạ (dùng với SandLayer). */
export function useSandTransition(active: number, duration = 900) {
  const [phase, setPhase] = useState<{ current: number; prev: number | null; progress: number }>({
    current: active, prev: null, progress: 1,
  });
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const prefersReduced = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (phase.current === active) return;

    if (prefersReduced.current) {
      setPhase({ current: active, prev: null, progress: 1 });
      return;
    }

    const prevChapter = phase.current;
    startRef.current = null;

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / duration, 1);
      setPhase({ current: active, prev: prevChapter, progress: t });
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPhase({ current: active, prev: null, progress: 1 });
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return phase;
}
