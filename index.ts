#!/usr/bin/env bun
import { Command } from "@commander-js/extra-typings";
import packageJson from "./package.json";
import { resolveModVersions } from "./api";
import { join } from "path";

type Config = {
  mods: Array<{ name: string; version: string; filename: string }>;
};

const initialConfig: Config = { mods: [] };

const isConfig = (value: unknown): value is Config => {
  if (typeof value === "object" && value !== null) {
    if (Array.isArray((value as Config).mods)) {
      return true;
    }
  }
  return false;
};

const cli = new Command()
  .version(packageJson.version)
  .name("vsmm")
  .description("CLI Tool to download and install vintage story mods")
  .option("-c, --config <path>", "Path to the config file", "./config.json")
  .option("-d, --directory <path>", "Path to the mods directory", "./mods")
  .option("-f, --force", "Force the operation")
  .command("install", "Install a mod")
  .argument("<name>")
  .alias("i")
  .action(async (modName) => {
    const config = await readConfig();

    const alreadyInstalled = config.mods.some(({ name }) => modName === name);

    if (alreadyInstalled && !cli.opts().force) {
      console.error("Mod is already installed");
      return;
    }
    const versions = await resolveModVersions(modName);
    const latestVersion = versions[0];

    if (!latestVersion) {
      console.error("No versions found");
      return;
    }

    if (!alreadyInstalled) {
      config.mods.push({
        name: modName,
        version: latestVersion.version,
        filename: latestVersion.filename,
      });
    }

    await writeConfig(config);
    console.log(`Install ${modName} version ${latestVersion.version}`);

    const download = await fetch(latestVersion.downloadUrl.href);
    const modFile = await download.blob();
    await Bun.write(
      Bun.file(join(cli.opts().directory, latestVersion.filename)),
      modFile
    );
  });

cli.parse();

async function readConfig() {
  const configFile = Bun.file(cli.opts().config);

  if (!(await configFile.exists())) {
    await writeConfig(initialConfig);
    return initialConfig;
  }

  const config = await configFile.json();

  if (isConfig(config)) {
    return config;
  }

  throw new Error("Invalid config file");
}

function writeConfig(config: Config) {
  return Bun.write(
    Bun.file(cli.opts().config),
    JSON.stringify(config, null, 2)
  );
}
