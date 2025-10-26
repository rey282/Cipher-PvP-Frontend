/* src/data/seasons.ts */

export const seasonOptions = [
  { label: "All-Time", value: "all" },
  { label: "Season 3", value: "players" },
  { label: "Season 2", value: "players_2" },
  { label: "Season 1", value: "players_1" },
] as const;

export type SeasonValue = (typeof seasonOptions)[number]["value"];

/* --- helpers --- */
export const seasonValues: SeasonValue[] = seasonOptions.map(s => s.value);

export function isSeasonValue(x: string | null | undefined): x is SeasonValue {
  return !!x && seasonValues.includes(x as SeasonValue);
}

export function getSeasonLabel(value: string | null | undefined): string {
  if (!value) return "";
  const found = seasonOptions.find(s => s.value === value);
  return found ? found.label : value; // safe fallback if backend ever adds a new one
}

/* ---------------- MOC cycles ---------------- */
export const mocOptions = [
  {
    label: "All-Time Stats",
    value: -1,
    name: "All-Time Stats",
    duration: "All matches recorded",
    bossImages: ["/bosses/alltime.png"],
  },
  {
    label: "Category Mistake (3.6)",
    value: 0,
    name: "Category Mistake",
    duration: "27 Oct 2025 → 08 Des 2025",
    bossImages: ["/bosses/aventurine.png", "/bosses/reaver.png"],
  },
  {
    label: "Pillar of Genesis (3.5)",
    value: 5,
    name: "Pillar of Genesis",
    duration: "15 Sep 2025 → 27 Oct 2025",
    bossImages: ["/bosses/gepard.png", "/bosses/lygus.png"],
  },
  {
    label: "Gambler's Plight (3.4)",
    value: 4,
    name: "Gambler's Plight",
    duration: "04 Aug 2025 → 15 Sep 2025",
    bossImages: ["/bosses/svarog.png", "/bosses/aventurine.png"],
  },
  {
    label: "Lupine Moon-Devourer (3.3)",
    value: 3,
    name: "Lupine Moon-Devourer",
    duration: "23 Jun 2025 → 04 Aug 2025",
    bossImages: ["/bosses/sting.png", "/bosses/hoolay.png"],
  },
  {
    label: "Breath of the Othershore (3.2)",
    value: 2,
    name: "Breath of the Othershore",
    duration: "12 May 2025 → 23 Jun 2025",
    bossImages: ["/bosses/reaver.png", "/bosses/tv.png"],
  },
  {
    label: "Out of Home (3.1)",
    value: 1,
    name: "Out of Home",
    duration: "31 Mar 2025 → 12 May 2025",
    bossImages: ["/bosses/hoolay.png", "/bosses/reaver.png"],
  },
] as const;

export type MocOption = (typeof mocOptions)[number];
export type MocValue = MocOption["value"];

export function getMocByValue(value: MocValue): MocOption {
  return mocOptions.find((m) => m.value === value) ?? mocOptions[0];
}
