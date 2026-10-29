# Football team crest catalogue

Funspot bundles football crests locally so ChatsCard, the Poke modal, the Action modal, and the messaging header do not depend on a live team-search API during normal rendering.

## Catalogue and formats

- Source: [JoseArroyave/football-logos](https://github.com/JoseArroyave/football-logos), a country-organized collection of 4,765 SVG team marks.
- Web: original SVG files in `apps/web/public/team-crests/`.
- React Native: transparent 256 × 256 PNG renditions in `apps/mobile/assets/team-crests/`.
- Generated normalized-name lookup maps: `apps/web/src/components/team-crest-catalog.generated.ts` and `apps/mobile/src/components/team-crest-catalog.generated.ts`.
- Current bundled catalogue: 4,763 SVG/PNG crest pairs. Two source SVGs could not be safely rasterized and are omitted from the generated map; the manifest records the current sync results.
- Asset license notice and source provenance: `apps/web/public/team-crests/THIRD_PARTY_LICENSES.txt` and `source-manifest.json`.

The UI uses local crests first, then a logo URL already supplied by fixture data, and finally a circular initial fallback. Names are Unicode-normalized, case-folded, and matched with common club suffixes removed. Circular framing and colors continue to come from the shared Funspot theme.

## Updating the catalogue

The GitHub Actions workflow **Sync bundled football team crests** runs when the sync script changes and can also be manually dispatched. It downloads the source tree, rasterizes SVGs with `sharp`, regenerates both platform maps, and commits the assets to `web-port-from-master`.

For a local sync, install the temporary rasterizer and run the root script:

```sh
npm install --no-save --package-lock=false --ignore-scripts --workspaces=false sharp
npm run sync:team-crests
```

The source repository is MIT-licensed; individual club and federation marks may still be trademarks. Review rights for the intended commercial use before distributing the app.
