export type AssetType = "fund" | "stock" | "cash";
export type Currency = "THB" | "USD";
export type TxType = "buy" | "sell";

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  category: string;
  currency: Currency;
  createdAt: string;
  order?: number;
  targetPct?: number;
  hidden?: boolean;
  /** User-entered public ticker (e.g. "IVV") used as a proxy for this Thai feeder fund's underlying master fund, for estimating an implied price. */
  masterFundTicker?: string;
  /** Currency the master fund ticker is priced in (e.g. "USD", "JPY", "EUR") — determines which FX pair is used to convert back to THB. Defaults to "USD" when unset. */
  masterFundCurrency?: string;
  /**
   * true if this fund distributes dividends instead of accumulating them
   * into NAV — the master-fund-implied-cost estimate assumes a constant
   * NAV-to-master-price ratio, which dividend payouts break (NAV stops
   * tracking the master fund proportionally), so that feature is disabled
   * for these funds.
   */
  paysDividend?: boolean;
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
  navDate?: string;
}

export interface FundLogEntry {
  date: string;
  assetId: string;
  units: number;
  price: number;
  costPerUnit: number;
  value: number;
  costValue: number;
  pnl: number;
  createdAt: string;
}

export interface Snapshot {
  date: string;
  currency: Currency;
  totalValue: number;
  totalCost: number;
  byCategoryJson: string;
  createdAt: string;
  /**
   * true = exempt from the daily cron's weekend-retention pruning (kept
   * forever regardless of day-of-week). Set on rows written by the manual
   * "save snapshot" button, and on historical rows predating the pruning
   * feature. Cron-written rows default to false/omitted.
   */
  manual?: boolean;
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
