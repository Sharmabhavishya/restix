// Photographs used on the landing page. These are the owner's own, from a night at their college
// fest, imported with `npm run photos` (watermarked, metadata stripped). Captions say what each
// picture shows; none of them is presented as a specific event that's on sale.
import type { StaticImageData } from "next/image";
import confettiYellow from "@/assets/photos/own-confetti-yellow.jpg";
import campusNight from "@/assets/photos/own-campus-night.jpg";
import confettiGreen from "@/assets/photos/own-confetti-green.jpg";
import smokeRed from "@/assets/photos/own-smoke-red.jpg";
import stageGreen from "@/assets/photos/own-stage-green.jpg";
import stageGreenWide from "@/assets/photos/own-stage-green-wide.jpg";

export type Photo = {
  src: StaticImageData;
  alt: string;
  caption: string;
  /**
   * object-position for any crop the layout makes. The watermark is baked into the bottom-right
   * corner, so crops keep that corner ("100% 100%") and trim from the top and left instead.
   */
  focus: string;
};

/** The band of pictures under the hero, in order. */
export const BAND_PHOTOS: Photo[] = [
  {
    src: confettiYellow,
    alt: "Confetti pouring over a packed crowd, lit yellow and violet by stage smoke",
    caption: "the confetti drop",
    focus: "100% 100%",
  },
  {
    src: campusNight,
    alt: "A night crowd under falling confetti, with a lit campus building behind",
    caption: "hostel lights behind the crowd",
    focus: "100% 100%",
  },
  {
    src: confettiGreen,
    alt: "Green confetti filling the air above raised hands and phones",
    caption: "green out",
    focus: "100% 100%",
  },
  {
    src: smokeRed,
    alt: "Red smoke rolling off the stage over the front rows, hands in the air",
    caption: "front row, red smoke",
    focus: "100% 100%",
  },
];

/**
 * The full-width moment between the safety board and the questions: a 16:9 cut (made at import,
 * so the mark survives) for wide screens, the full portrait for phones.
 */
export const MOMENT_PHOTO: Photo & { wide: StaticImageData } = {
  src: stageGreen,
  wide: stageGreenWide,
  alt: "A festival stage glowing green under steel truss, confetti falling on the crowd",
  caption: "main stage, the night of",
  focus: "100% 100%",
};

/** Short muted loops shot on the same nights (public/media), each with a stamped poster. */
export const CLIPS = {
  stageLights: { src: "/media/stage-lights.mp4", poster: "/media/stage-lights-poster.jpg" },
  handsUp: { src: "/media/hands-up.mp4", poster: "/media/hands-up-poster.jpg" },
  blueStage: { src: "/media/blue-stage.mp4", poster: "/media/blue-stage-poster.jpg" },
} as const;
