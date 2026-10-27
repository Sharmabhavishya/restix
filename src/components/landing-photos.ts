// Open-licence photographs of the fest world, used on the landing page with credit in the footer.
// They show wristbands and campus nights in general; none of them is presented as a ResTix event.
// Files are resized only (never recoloured or combined), so the share-alike terms carry over as is.
import type { StaticImageData } from "next/image";
import pronite from "@/assets/photos/pronite-mood-indigo.jpg";
import wristbands from "@/assets/photos/festival-wristbands.jpg";
import paperBand from "@/assets/photos/paper-wristband.jpg";
import wall from "@/assets/photos/mood-indigo-wall.jpg";
import crowd from "@/assets/photos/fest-crowd.jpg";

export type Photo = {
  src: StaticImageData;
  alt: string;
  caption: string;
  /** object-position for the crop */
  focus: string;
  /** Only for open-licence pictures; photos the ResTix team took need none. */
  credit?: { title: string; author: string; licence: string; licenceUrl: string; url: string; via: string };
};

const BY_SA_3 = { licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/" };
const BY_SA_4 = { licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };
const BY_2 = { licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/" };

/** The band of pictures under the hero, in order. */
export const BAND_PHOTOS: Photo[] = [
  {
    src: pronite,
    alt: "A packed crowd in front of a band playing under red stage lights at night",
    caption: "Pronite, Mood Indigo, IIT Bombay",
    focus: "50% 40%",
    credit: { title: "Pronites at Mood Indigo 2012", author: "Parth loya", ...BY_SA_3, url: "https://commons.wikimedia.org/wiki/File:Pronites_at_Mood_Indigo_2012.JPG", via: "Wikimedia Commons" },
  },
  {
    src: wristbands,
    alt: "Three worn festival wristbands, paper and woven, stacked on one wrist",
    caption: "Weekend bands, three deep",
    focus: "55% 50%",
    credit: { title: "Doune the Rabbit Hole festival 2022", author: "conall..", ...BY_2, url: "https://www.flickr.com/photos/16176711@N02/52223642482", via: "Flickr" },
  },
  {
    src: paperBand,
    alt: "A lilac paper wristband printed with a festival name, close up on a wrist",
    caption: "A paper band, the classic",
    focus: "45% 55%",
    credit: { title: "Wristband for press screenings of the 2022 Berlin Film Festival", author: "IgorCalzone1", ...BY_SA_4, url: "https://commons.wikimedia.org/w/index.php?curid=114388817", via: "Wikimedia Commons" },
  },
  {
    src: wall,
    alt: "A graffiti wall painted for a college culture festival, in red, blue and black",
    caption: "Fest wall, Mood Indigo",
    focus: "78% 70%",
    credit: { title: "Graffiti Mood Indigo", author: "Trinidade", ...BY_SA_3, url: "https://commons.wikimedia.org/w/index.php?curid=20315268", via: "Wikimedia Commons" },
  },
];

/** The crowd beside the closing statement. */
export const CLOSING_PHOTO: Photo = {
  src: crowd,
  alt: "A festival crowd with hands and phones raised under purple and yellow stage lights",
  caption: "A fest main stage, hands up",
  focus: "50% 60%",
  credit: { title: "Beach-Please-2022-crowd-stage-lights-night-performance", author: "PinkBeachPlanet", ...BY_SA_4, url: "https://commons.wikimedia.org/wiki/File:Beach-Please-2022-crowd-stage-lights-night-performance.jpg", via: "Wikimedia Commons" },
};

export const ALL_PHOTOS = [...BAND_PHOTOS, CLOSING_PHOTO];
