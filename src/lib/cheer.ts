/**
 * Cheering-character logic: which image and which line of encouragement to
 * show for the baht portfolio's change since the previous saved snapshot (a
 * deposit-neutral percentage, see computeChangeSincePrevious).
 */

export type DailyTier = "none" | "surge" | "up" | "flat" | "down" | "drop" | "plunge";

/**
 * surge  > +3%
 * up     +1 .. +3%
 * flat    0 .. +1%   (0 included)
 * down   -3 .. 0%
 * drop   -5 .. -3%
 * plunge < -5%
 */
export function dailyTier(pct: number | null | undefined): DailyTier {
  if (pct == null || !Number.isFinite(pct)) return "none";
  // Round to the 2 decimals shown on screen, so a "-0.00%" reads as flat
  // rather than as a loss (Math.round keeps -0, and -0 >= 0 is true).
  const p = Math.round(pct * 100) / 100;
  if (p > 3) return "surge";
  if (p >= 1) return "up";
  if (p >= 0) return "flat";
  if (p >= -3) return "down";
  if (p >= -5) return "drop";
  return "plunge";
}

/** Image shown for each tier (public/investor-<tier>.png); no data falls back to the calm pose. */
export function imageTier(tier: DailyTier): Exclude<DailyTier, "none"> {
  return tier === "none" ? "flat" : tier;
}

// Patient-DCA tone: when it's red, stay calm, sit on your hands, keep buying on plan.
const MESSAGES: Record<Exclude<DailyTier, "none">, string[]> = {
  surge: [
    "พอร์ตพุ่งแรงเลย! ดีใจด้วยนะ แต่อย่าไล่ซื้อตามอารมณ์ DCA ตามแผนต่อไปก็พอ",
    "เขียวสวยเลย! วินัยสำคัญกว่าจังหวะ ทำตามแผนที่วางไว้ต่อไป",
    "จรวดขึ้นแล้ว! ไม่ต้องรีบขาย ไม่ต้องรีบซื้อเพิ่ม ปล่อยให้เวลาทำงาน",
  ],
  up: [
    "เขียวสวย ไปต่อได้ดี DCA สม่ำเสมอคือกุญแจสำคัญ",
    "สะสมไปเรื่อยๆ ก็ถึงเป้าได้ สู้ๆ",
    "ค่อยๆ โตแบบนี้แหละดี ความสม่ำเสมอชนะทุกอย่าง",
  ],
  flat: [
    "ขยับขึ้นนิดๆ ก็ยังเป็นเขียว สะสมทีละก้าวไปเรื่อยๆ",
    "ค่อยๆ เก็บไปทีละนิด ไม่ต้องรีบ ถึงเป้าแน่นอน",
    "สงบๆ แบบนี้ก็ดี DCA ตามแผนต่อไปเลย",
  ],
  down: [
    "ลงนิดหน่อยเป็นเรื่องปกติ ใจเย็นๆ DCA ต่อไป ราคาถูกลงคือได้หน่วยเพิ่ม",
    "แดงเล็กน้อยไม่ต้องกลัว นั่งทับมือไว้ อย่าเพิ่งขายตามอารมณ์",
    "วันนี้นิ่งๆ หรือลงนิดหน่อยก็ไม่เป็นไร นั่งทับมือรอจังหวะไป ไม่ต้องทำอะไรเยอะ",
  ],
  drop: [
    "ลงแรงหน่อย หายใจลึกๆ อดทนไว้ ไม่ขายตอนตกใจ",
    "ตลาดแรงๆ มีให้เห็นเป็นปกติ นั่งทับมือ ถือไว้ก่อน แล้ว DCA ต่อตามแผน",
    "ราคาที่ลงคือโอกาสสะสมหน่วยเพิ่มสำหรับคนที่ DCA",
  ],
  plunge: [
    "หนักจริงๆ ช่วงนี้ ไม่เป็นไรนะ ปิดแอปแล้วพักสักหน่อย ไม่ต้องตัดสินใจอะไรตอนนี้",
    "ตลาดตกแรงก็เกิดขึ้นได้ คนที่ถือยาวผ่านมาหมดแล้ว ถือไว้ ไม่ขายตอนตกใจ DCA ต่อเนื่อง",
    "วันแดงหนักๆ คือบททดสอบวินัย ถือไว้ นั่งทับมือ แล้วสะสมต่อตามแผน",
  ],
};

/**
 * One line for the tier, varying by day but stable within a day (so a page
 * refresh doesn't shuffle the message).
 */
export function dailyMessage(tier: DailyTier, dateKey: string): string | null {
  if (tier === "none") return null;
  const list = MESSAGES[tier];
  let hash = 0;
  for (const ch of dateKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return list[hash % list.length];
}
