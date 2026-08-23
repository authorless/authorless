import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { generateSnakeAnimation } from "generate-snake-animation";

const CONTRIBUTION_LEVELS = [
  "NONE",
  "FIRST_QUARTILE",
  "SECOND_QUARTILE",
  "THIRD_QUARTILE",
  "FOURTH_QUARTILE",
];

const contributionLevelNumber = (level) => {
  const index = CONTRIBUTION_LEVELS.indexOf(level);
  return index < 0 ? 0 : index;
};

export const parseProfileLevels = (html) => {
  const levels = new Map();
  const cellPattern =
    /<(?:td|rect)\b[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g;

  for (const match of html.matchAll(cellPattern)) {
    const tag = match[0];
    const level = Number(tag.match(/\bdata-level="([0-4])"/)?.[1]);

    if (Number.isInteger(level)) {
      levels.set(match[1], level);
    }
  }

  if (levels.size < 300) {
    throw new Error(
      `GitHub profile calendar parsing returned only ${levels.size} days`,
    );
  }

  return levels;
};

export const mergeProfileLevels = (payload, profileLevels) => {
  const weeks =
    payload?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;

  if (!Array.isArray(weeks)) {
    throw new Error(
      "GitHub GraphQL response does not contain a contribution calendar",
    );
  }

  let matchedDays = 0;
  let restoredDays = 0;

  for (const week of weeks) {
    for (const day of week.contributionDays ?? []) {
      const profileLevel = profileLevels.get(day.date);
      if (profileLevel === undefined) continue;

      matchedDays += 1;
      const graphqlLevel = contributionLevelNumber(day.contributionLevel);
      const mergedLevel = Math.max(graphqlLevel, profileLevel);

      if (mergedLevel > graphqlLevel) restoredDays += 1;

      day.contributionLevel = CONTRIBUTION_LEVELS[mergedLevel];
      if (mergedLevel > 0 && day.contributionCount === 0) {
        day.contributionCount = 1;
      }
    }
  }

  if (matchedDays < 300) {
    throw new Error(`GitHub calendars overlap on only ${matchedDays} days`);
  }

  return { matchedDays, restoredDays };
};

export const createProfileAwareFetch = (nativeFetch, username) => {
  return async (input, init) => {
    const response = await nativeFetch(input, init);
    const url = typeof input === "string" ? input : input?.url;

    if (url !== "https://api.github.com/graphql" || !response.ok) {
      return response;
    }

    let request;
    try {
      request = JSON.parse(init?.body ?? "{}");
    } catch {
      return response;
    }

    if (!request.query?.includes("contributionCalendar")) {
      return response;
    }

    const payload = await response.json();
    const profileResponse = await nativeFetch(
      `https://github.com/users/${encodeURIComponent(username)}/contributions`,
      {
        headers: {
          Accept: "text/html",
          "User-Agent": "authorless-profile-snake/1.0",
        },
      },
    );

    if (!profileResponse.ok) {
      throw new Error(
        `GitHub profile calendar request failed with ${profileResponse.status}`,
      );
    }

    const profileLevels = parseProfileLevels(await profileResponse.text());
    const result = mergeProfileLevels(payload, profileLevels);
    console.log(
      `GitHub profile calendar matched ${result.matchedDays} days and restored ${result.restoredDays} missing active day(s)`,
    );

    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers: { "Content-Type": "application/json" },
    });
  };
};

const output = (colorEmpty, colorDots) => ({
  format: "svg",
  drawOptions: {
    colorDots,
    colorEmpty,
    colorDotBorder: "#1b1f230a",
    colorSnake: "#F59E0B",
    sizeCell: 16,
    sizeDot: 12,
    sizeDotBorderRadius: 2,
  },
  animationOptions: {
    frameByStep: 1,
    stepDurationMs: 100,
  },
});

export const main = async () => {
  const username = process.env.GITHUB_REPOSITORY_OWNER;
  const token = process.env.SNAKE_TOKEN;

  if (!username) throw new Error("GITHUB_REPOSITORY_OWNER is not set");
  if (!token) throw new Error("SNAKE_TOKEN is not set");

  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = createProfileAwareFetch(nativeFetch, username);

  const outputs = [
    output("#EBEDF0", [
      "#EBEDF0",
      "#FDE68A",
      "#FBBF24",
      "#F59E0B",
      "#D97706",
    ]),
    output("#161B22", [
      "#161B22",
      "#452F0A",
      "#7A4F0B",
      "#B86F0B",
      "#F59E0B",
    ]),
  ];

  const results = await generateSnakeAnimation(
    {
      platform: "github",
      username,
      githubToken: token,
    },
    outputs,
  );

  await mkdir("dist", { recursive: true });
  await Promise.all([
    writeFile("dist/github-contribution-grid-snake.svg", results[0]),
    writeFile("dist/github-contribution-grid-snake-dark.svg", results[1]),
  ]);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
