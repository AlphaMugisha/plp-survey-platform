import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A real-photo slot with an artwork fallback.
 *
 * Drop a file into `public/images/` with the matching name and it is used
 * automatically — no code change. Until then, the imigongo artwork passed as
 * `fallback` is shown, so the page never has a grey placeholder box in it.
 *
 * The existence check runs on the server at render time. These pages are
 * statically generated, so **rebuild (or restart the dev server) after adding a
 * photo** for it to appear.
 *
 * See `public/images/README.md` for the slot names and sizes.
 */

const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

/** Resolve `name` to a real file under public/images, or null. */
function findPhoto(name: string): string | null {
  for (const ext of EXTENSIONS) {
    const rel = `images/${name}.${ext}`;
    if (existsSync(join(process.cwd(), "public", rel))) return `/${rel}`;
  }
  return null;
}

export function PhotoSlot({
  name,
  alt,
  width,
  height,
  className,
  imageClassName,
  fallback,
  priority = false,
}: {
  /** File base name under public/images, e.g. "hero" for hero.jpg */
  name: string;
  /** Required. Describe the photograph for people who cannot see it. */
  alt: string;
  width: number;
  height: number;
  className?: string;
  imageClassName?: string;
  /** Shown when no photo has been supplied. */
  fallback: React.ReactNode;
  priority?: boolean;
}) {
  const src = findPhoto(name);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 50vw"
          className={cn("size-full object-cover", imageClassName)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
