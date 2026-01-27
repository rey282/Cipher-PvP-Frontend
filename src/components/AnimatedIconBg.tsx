import { useEffect, useMemo, useRef } from "react";

type Props = {
  iconUrls: string[]; // e.g. ["/abundance.png", "/fire.png", ...]
  opacity?: number; // 0.05..0.18
  spawnMs?: number; // 450..900
  maxParticles?: number; // 40..90
  sizeRange?: [number, number]; // px range
};

type LoadedIcon = { url: string; img: HTMLImageElement; ok: boolean };

export default function AnimatedIconBg({
  iconUrls,
  opacity = 0.12,
  spawnMs = 550,
  maxParticles = 70,
  sizeRange = [18, 44],
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const uniqueUrls = useMemo(
    () => Array.from(new Set(iconUrls)).filter(Boolean),
    [iconUrls],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // ---- preload icons ----
    let cancelled = false;
    const loaded: LoadedIcon[] = uniqueUrls.map((url) => {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = url;
      return { url, img, ok: false };
    });

    const preload = async () => {
      await Promise.all(
        loaded.map(
          (it) =>
            new Promise<void>((resolve) => {
              it.img.onload = () => {
                it.ok = true;
                resolve();
              };
              it.img.onerror = () => resolve(); // keep going even if one fails
            }),
        ),
      );
    };

    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      life: number;
      rot: number;
      rotV: number;
      size: number;
      icon: LoadedIcon;
    };

    const particles: Particle[] = [];
    let raf = 0;
    let interval = 0;

    const spawn = () => {
      const usable = loaded.filter((x) => x.ok);
      if (!usable.length) return;

      const icon = usable[(Math.random() * usable.length) | 0];

      const [minS, maxS] = sizeRange;
      const size = minS + Math.random() * (maxS - minS);

      const fromRight = Math.random() > 0.5;
      const x = fromRight
        ? window.innerWidth + 200
        : Math.random() * window.innerWidth;
      const y = fromRight
        ? Math.random() * window.innerHeight
        : window.innerHeight + 80;

      const speed = 0.6 + Math.random() * 1.6;
      const angle = -Math.PI / 2 - Math.random() * 0.55; // mostly up-left
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      particles.push({
        x,
        y,
        vx,
        vy,
        alpha: 0,
        life: 0,
        rot: (Math.random() - 0.5) * 0.35,
        rotV: (Math.random() - 0.5) * 0.002,
        size,
        icon,
      });

      if (particles.length > maxParticles) {
        particles.splice(0, particles.length - maxParticles);
      }
    };

    let last = 0;
    const FPS = 30;
    const frameMs = 1000 / FPS;

    const draw = (t = 0) => {
      if (t - last < frameMs) {
        raf = requestAnimationFrame(draw);
        return;
      }

      // dt measured in "60fps frames" so speed feels same as before
      const dt = last ? (t - last) / (1000 / 60) : 1;
      last = t;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.life += dt;
        p.rot += p.rotV * dt;

        if (p.life < 40) {
          p.alpha = Math.min(1, p.alpha + 0.04 * dt);
        } else {
          p.alpha = 1;
        }

        if (p.x < -800 || p.y < -400 || p.y > window.innerHeight + 800) {
          particles.splice(i, 1);
          continue;
        }

        const s = p.size;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);

        ctx.globalAlpha = p.alpha * opacity;
        ctx.drawImage(p.icon.img, -s / 2, -s / 2, s, s);

        ctx.restore();



      }

      raf = requestAnimationFrame(draw);
    };


    (async () => {
      await preload();
      if (cancelled) return;
      interval = window.setInterval(spawn, spawnMs);
      raf = requestAnimationFrame(draw);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      if (interval) window.clearInterval(interval);
      cancelAnimationFrame(raf);
    };
  }, [uniqueUrls, opacity, spawnMs, maxParticles, sizeRange]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1, // above bg, below overlay/content
        pointerEvents: "none",
      }}
    />
  );
}
