import { readFileSync, writeFileSync } from "node:fs";

const [readmePath, renderedSectionPath] = process.argv.slice(2);

if (!readmePath || !renderedSectionPath) {
  throw new Error(
    "Usage: node update-hackatime-section.mjs <README> <rendered section>",
  );
}

const startMarker = "<!--START_SECTION:hackatime-->";
const endMarker = "<!--END_SECTION:hackatime-->";
const readme = readFileSync(readmePath, "utf8");
const renderedSection = readFileSync(renderedSectionPath, "utf8").trim();

const startIndex = readme.indexOf(startMarker);
const endIndex = readme.indexOf(endMarker);

if (
  startIndex === -1 ||
  endIndex === -1 ||
  startIndex >= endIndex ||
  readme.indexOf(startMarker, startIndex + startMarker.length) !== -1 ||
  readme.indexOf(endMarker, endIndex + endMarker.length) !== -1
) {
  throw new Error("README must contain exactly one valid Hackatime marker pair");
}

if (!renderedSection) {
  throw new Error("Markscribe rendered an empty Hackatime section");
}

const before = readme.slice(0, startIndex + startMarker.length);
const after = readme.slice(endIndex);
const updatedReadme = `${before}\n${renderedSection}\n${after}`;

if (updatedReadme !== readme) {
  writeFileSync(readmePath, updatedReadme, "utf8");
}
