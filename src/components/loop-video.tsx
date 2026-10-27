"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * A muted, looping clip from a real campus night. Decorative: it never carries information.
 *
 * The stamped poster is a real image (so it, not the video, is what paints first and counts as
 * the page's largest paint); the clip sits on top at exactly the same size and fades in once it's
 * actually playing. Nothing downloads until the page has loaded and the clip is in view; it pauses
 * when it leaves, and never plays for anyone with reduced motion or Data Saver on.
 */
export function LoopVideo({
  src, poster, className = "", priority = false,
}: { src: string; poster: string; className?: string; priority?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (still || saveData) return;
    let io: IntersectionObserver | undefined;
    const start = () => {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!video.getAttribute("src")) video.src = src;
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        },
        { threshold: 0.15 },
      );
      io.observe(video);
    };
    // Let the page finish loading first; the clip is a treat, not the content.
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      io?.disconnect();
    };
  }, [src]);

  return (
    // Callers position the wrapper (relative, or absolute to fill a shape); the layers need one.
    <div aria-hidden className={`overflow-hidden ${className}`}>
      <Image src={poster} alt="" fill priority={priority} sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        onPlaying={() => setPlaying(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${playing ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
