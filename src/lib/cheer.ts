/**
 * Cheering-character logic: which mood/image and which line of encouragement
 * to show for the baht portfolio's change since the previous day (a
 * deposit-neutral percentage, see computeDailyChange).
 */

export type DailyTier = "none" | "surge" | "up" | "down" | "plunge";
export type Mood = "happy" | "rocket" | "sad" | "crying";

/** surge > +3%, up 0..+3%, down below 0 down to -3%, plunge < -3%. */
export function dailyTier(pct: number | null | undefined): DailyTier {
  if (pct == null || !Number.isFinite(pct)) return "none";
  if (pct > 3) return "surge";
  if (pct >= 0) return "up";
  if (pct >= -3) return "down";
  return "plunge";
}

export const MOOD_BY_TIER: Record<DailyTier, Mood> = {
  none: "happy",
  surge: "rocket",
  up: "happy",
  down: "sad",
  plunge: "crying",
};

// Patient-DCA tone: when it's red, stay calm, sit on your hands, keep buying on plan.
const MESSAGES: Record<Exclude<DailyTier, "none">, string[]> = {
  surge: [
    "วันนี้พอร์ตพุ่งแรง! ดีใจด้วยนะ แต่อย่าไล่ซื้อตามอารมณ์ DCA ตามแผนต่อไปก็พอ",
    "เขียวสวยเลย! จำไว้ว่าวินัยสำคัญกว่าจังหวะ ทำตามแผนที่วางไว้ต่อไป",
    "จรวดขึ้นแล้ว! ใจเย็นๆ ไม่ต้องรีบขาย ไม่ต้องรีบซื้อเพิ่ม ปล่อยให้เวลาทำงาน",
  ],
  up: [
    "เขียวทีละนิด สะสมไปเรื่อยๆ ก็ถึงเป้าได้ สู้ๆ",
    "วันนี้ไปต่อได้ดี DCA สม่ำเสมอคือกุญแจสำคัญ",
    "ค่อยๆ โตก็ไม่เป็นไร ความสม่ำเสมอชนะทุกอย่าง",
    "วันนี้นิ่งๆ ก็ไม่เป็นไร นั่งทับมือรอจังหวะไป ไม่ต้องทำอะไรเยอะ",
  ],
  down: [
    "ลงนิดหน่อยเป็นเรื่องปกติ ใจเย็นๆ DCA ต่อไป ราคาถูกลงคือได้หน่วยเพิ่ม",
    "แดงเล็กน้อยไม่ต้องกลัว นั่งทับมือไว้ อย่าเพิ่งขายตามอารมณ์",
    "วันนี้ลงหน่อย แต่แผนระยะยาวไม่เปลี่ยน อดทนไว้ แล้ว DCA ต่อ",
  ],
  plunge: [
    "วันนี้หนักหน่อย ไม่เป็นไรนะ หายใจลึกๆ อดทนไว้ ไม่ขายตอนตกใจ DCA ต่อเนื่อง",
    "ตลาดแรงๆ มีให้เห็นเป็นปกติ นั่งทับมือรอจังหวะ ถือไว้ก่อน แล้วสะสมต่อตามแผน",
    "ใจเย็นๆ ก่อนกดขาย ราคาที่ลงคือโอกาสสะสมหน่วยเพิ่มสำหรับคนที่ DCA",
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
