# Photos

Drop real PLP photographs in this folder and they appear on the site
automatically — **no code change needed**. Until a file is present, each slot
shows imigongo-inspired artwork instead, so the page never looks unfinished.

> Static pages are generated at build time, so **restart `npm run dev`** (or
> re-run `npm run build`) after adding a photo.

## Slots

| File name | Where it appears | Recommended size | Crop |
|---|---|---|---|
| `hero.*` | Beside the survey title at the top of the landing page | 1200 × 960 | landscape, 5:4 |
| `about.*` | The "About us" section | 1000 × 750 | landscape, 4:3 |

Accepted extensions, in priority order: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
So `hero.jpg` and `hero.webp` both work — name the file for the slot, not the subject.

## Choosing photos

- **Real PLP photographs only.** No stock imagery — it is obvious, and it
  undermines a page students are asked to trust.
- Pictures of actual club sessions, Walk to Remember, or PLP Academy workshops
  work far better than posed group shots.
- Landscape crops. Portraits will be centre-cropped and usually lose heads.
- Aim for under ~400 KB each. `.webp` gives the best quality per byte.

## Permission

Get consent before publishing photographs of students, and follow whatever
safeguarding policy PLP already applies to its own channels. If in doubt, use
wide shots where individuals are not identifiable — or leave the artwork, which
is designed to stand on its own.

## Alt text

Each slot has alt text written in the page source. If you change the photo,
update the `alt` to describe the new one — screen-reader users and anyone on a
slow connection rely on it. The slots are in `src/app/page.tsx`.
