import { JSDOM } from "jsdom";

const modDbUrl = new URL("https://mods.vintagestory.at/");

export const resolveModVersions = async (modName: string) => {
  let modUrl: URL;

  if (Number.isNaN(Number.parseInt(modName))) {
    modUrl = new URL(modName, modDbUrl);
  } else {
    modUrl = new URL(`show/mod/${modName}`, modDbUrl);
  }

  const modPage = await fetch(modUrl.href);

  if (!modPage.ok) {
    throw new Error(`Mod not found: ${modName}`);
  }

  const html = new JSDOM(await modPage.text()).window.document;

  const modVersionDownloadLink = html.querySelectorAll(
    "div[id='files'] tbody tr td a[class='downloadbutton']"
  );

  if (modVersionDownloadLink.length === 0) {
    throw new Error("Mod has no versions");
  }

  const versions = Array.of(...modVersionDownloadLink.values()).map(
    (linkElement) => {
      const downloadHref = linkElement.getAttribute("href");
      const filename = linkElement.textContent;

      if (!downloadHref || !filename) {
        throw new Error("No download link found");
      }

      const versionTableEntry = linkElement.parentNode?.parentNode;

      const version = versionTableEntry?.childNodes[1].firstChild?.textContent
        ?.replaceAll("\t", "")
        .replaceAll("\n", "")
        .replaceAll("v", "");

      if (!version) {
        throw new Error("No version found");
      }

      const supportedGameVersionNode = (
        versionTableEntry?.childNodes[3].childNodes[1]
          .childNodes[1] as HTMLAnchorElement
      ).textContent;

      if (!supportedGameVersionNode) {
        throw new Error("No supported game version found");
      }

      return {
        version,
        filename,
        supportedGameVersion: supportedGameVersionNode
          ?.replaceAll("Various v", "")
          .replaceAll(/(\*|v|#)/g, ""),
        downloadUrl: new URL(downloadHref, modUrl),
      };
    }
  );
  return versions.toSorted((a, b) => -Bun.semver.order(a.version, b.version));
};
