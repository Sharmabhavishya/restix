"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

/**
 * Pick a cover image for an event. The browser shrinks it first (1600px on the long side, WebP),
 * so uploads stay small on slow connections; the server still re-encodes and checks it.
 */
export function CoverPicker({ current, name }: { current?: string | null; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function shrink(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That isn't an image. Use a JPEG, PNG or WebP.");
      return;
    }
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/webp", 0.82));
      if (!blob) throw new Error("encode");
      if (blob.size > 1_400_000) {
        setError("Even shrunk, that image is too big. Try a simpler one.");
        return;
      }
      const out = new File([blob], "cover.webp", { type: "image/webp" });
      const list = new DataTransfer();
      list.items.add(out);
      input.current!.files = list.files;
      setPreview(URL.createObjectURL(out));
      setRemoving(false);
    } catch {
      setError("Couldn't read that image. Try a JPEG or PNG.");
      if (input.current) input.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Cover image <span className="font-normal text-muted">(optional)</span></span>
      <label className="group relative flex aspect-[16/8] cursor-pointer items-end overflow-hidden rounded-[18px] border-2 border-dashed border-control bg-raised transition-colors hover:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent">
        {preview && !removing ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: or our own route) */}
            <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.7),transparent_60%)]" />
            <span className="relative p-4 font-display text-2xl leading-none font-extrabold tracking-[-0.03em] text-white">{name || "Your event"}</span>
            <span className="absolute top-3 right-3 rounded-full bg-black/55 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur-sm">Change</span>
          </>
        ) : (
          <span className="m-auto flex flex-col items-center gap-2 text-center text-sm text-muted">
            <ImagePlus className="size-7 text-accent-strong transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden />
            <span className="font-medium text-ink">{busy ? "Getting it ready…" : "Add a cover"}</span>
            <span className="text-[12px]">A poster or a photo from the event. Wide works best.</span>
          </span>
        )}
        <input
          ref={input}
          type="file"
          name="cover"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && shrink(e.target.files[0])}
        />
      </label>
      {error && <p className="text-[13px] font-medium text-negative" role="alert">{error}</p>}
      {current && (
        <label className="flex items-center gap-2 self-start text-[13px] text-muted">
          <input type="checkbox" name="removeCover" checked={removing} onChange={(e) => setRemoving(e.target.checked)} className="accent-accent" />
          <Trash2 className="size-3.5" aria-hidden /> Remove the cover
        </label>
      )}
    </div>
  );
}
