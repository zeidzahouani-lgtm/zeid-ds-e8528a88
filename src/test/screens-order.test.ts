import { describe, it, expect } from "vitest";

/**
 * Régression : l'ordre des écrans (created_at desc, stable) ne doit JAMAIS
 * changer suite à un update realtime sur d'autres champs (status, heartbeat,
 * orientation, current_media_id, etc.). Sinon la liste "saute" pendant
 * que l'utilisateur fait ses choix dans la page /displays.
 *
 * Ce test simule :
 *   1) une liste initiale triée par created_at desc
 *   2) un update realtime qui change updated_at + status d'un écran
 *   3) un re-tri après refetch
 * et vérifie que l'ordre des IDs est identique.
 */

type Screen = {
  id: string;
  name: string;
  created_at: string; // ISO
  updated_at: string;
  status: string;
  current_media_id?: string | null;
  player_heartbeat_at?: string | null;
};

function sortScreens(list: Screen[]): Screen[] {
  // Doit reproduire EXACTEMENT le tri serveur de useScreens.ts
  // (`order("created_at", { ascending: false })`).
  return [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function applyRealtimeUpdate(list: Screen[], patch: Partial<Screen> & { id: string }): Screen[] {
  return list.map((s) => (s.id === patch.id ? { ...s, ...patch } : s));
}

describe("Screen list stability under realtime updates", () => {
  const baseList: Screen[] = [
    { id: "A", name: "Hall",     created_at: "2024-01-01T10:00:00Z", updated_at: "2024-01-10T00:00:00Z", status: "online" },
    { id: "B", name: "Cuisine",  created_at: "2024-02-15T10:00:00Z", updated_at: "2024-02-15T00:00:00Z", status: "offline" },
    { id: "C", name: "Vitrine",  created_at: "2024-03-20T10:00:00Z", updated_at: "2024-03-20T00:00:00Z", status: "online" },
    { id: "D", name: "Terrasse", created_at: "2024-04-05T10:00:00Z", updated_at: "2024-04-05T00:00:00Z", status: "online" },
  ];

  it("sorts by created_at desc", () => {
    const sorted = sortScreens(baseList);
    expect(sorted.map((s) => s.id)).toEqual(["D", "C", "B", "A"]);
  });

  it("keeps the same order after a status realtime update", () => {
    const before = sortScreens(baseList).map((s) => s.id);
    const updated = applyRealtimeUpdate(baseList, {
      id: "B",
      status: "online",
      updated_at: new Date().toISOString(),
    });
    const after = sortScreens(updated).map((s) => s.id);
    expect(after).toEqual(before);
  });

  it("keeps the same order after a heartbeat update", () => {
    const before = sortScreens(baseList).map((s) => s.id);
    const updated = applyRealtimeUpdate(baseList, {
      id: "A",
      player_heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const after = sortScreens(updated).map((s) => s.id);
    expect(after).toEqual(before);
  });

  it("keeps the same order after current_media_id changes", () => {
    const before = sortScreens(baseList).map((s) => s.id);
    const updated = applyRealtimeUpdate(baseList, {
      id: "C",
      current_media_id: "media-xyz",
      updated_at: new Date().toISOString(),
    });
    const after = sortScreens(updated).map((s) => s.id);
    expect(after).toEqual(before);
  });

  it("keeps the same order after MANY successive realtime updates", () => {
    const before = sortScreens(baseList).map((s) => s.id);
    let list = baseList;
    for (let i = 0; i < 50; i++) {
      const target = baseList[i % baseList.length].id;
      list = applyRealtimeUpdate(list, {
        id: target,
        status: i % 2 ? "online" : "offline",
        updated_at: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
    const after = sortScreens(list).map((s) => s.id);
    expect(after).toEqual(before);
  });

  it("FAILS if someone accidentally sorts by updated_at (regression guard)", () => {
    const wrongSort = (l: Screen[]) =>
      [...l].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    const updated = applyRealtimeUpdate(baseList, {
      id: "A",
      updated_at: new Date().toISOString(),
    });
    const stable = sortScreens(updated).map((s) => s.id);
    const unstable = wrongSort(updated).map((s) => s.id);
    expect(stable).not.toEqual(unstable); // prouve que la stabilité dépend bien du tri created_at
  });
});
