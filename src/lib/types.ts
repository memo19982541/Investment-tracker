export type AssetType = "fund" | "stock";
export type Currency = "THB" | "USD";
export type TxType = "buy" | "sell";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  category: string;
  currency: Currency;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  assetId: string;
  type: TxType;
  units: number;
  pricePerUnit: number;
  totalValue: number;
  note: string;
  createdAt: string;
}

export interface PriceEntry {
  assetId: string;
  price: number;
  updatedAt: string;
}

export interface Snapshot {
  date: string;
  totalValue: number;
  totalCost: number;
  byCategoryJson: string;
  createdAt: string;
}

export interface Holding {
  asset: Asset;
  units: number;
  cost: number;
  price: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
}

export const DEFAULT_CATEGORIES = [
  "CORE",
  "Cash",
  "Future",
  "Gold",
  "หุ้นสหรัฐ",
];
