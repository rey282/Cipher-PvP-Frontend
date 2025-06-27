/* src/data/seasons.ts */

export const seasonOptions = [
    { label: "All-Time", value: "all" },
    { label: "Season 2", value: "players" },
    { label: "Season 1", value: "players_1" },
  ] as const;
  
  export type SeasonValue = (typeof seasonOptions)[number]["value"];