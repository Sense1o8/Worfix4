// Regenerates src/lib/geo/geo.json (all countries + their provinces/states) from the country-state-city dataset.
// Run: node scripts/build-geo.mjs
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL("../node_modules/country-state-city/lib/assets/", import.meta.url);
const countries = JSON.parse(readFileSync(new URL("country.json", dir), "utf8"));
const states = JSON.parse(readFileSync(new URL("state.json", dir), "utf8"));
const out = countries
  .map((c) => ({
    c: c.isoCode,
    n: c.name,
    s: states.filter((s) => s.countryCode === c.isoCode).map((s) => s.name).sort((a, b) => a.localeCompare(b)),
  }))
  .sort((a, b) => a.n.localeCompare(b.n));
writeFileSync(new URL("../src/lib/geo/geo.json", import.meta.url), JSON.stringify(out));
console.log(out.length, "countries,", out.reduce((a, c) => a + c.s.length, 0), "provinces");
