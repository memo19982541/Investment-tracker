import type { Asset, AssetType } from "./types";

const TYPE_ORDER: Record<AssetType, number> = { cash: 0, fund: 1, stock: 2 };

/** Order for asset dropdowns: cash, then funds, then stocks; A→Z within each. */
export function sortAssetsForPicker(assets: Asset[]): Asset[] {
  return [...assets].sort(
    (a, b) =>
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true })
  );
}
