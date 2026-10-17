// TypeScript Interfaces สำหรับระบบการ์ด ไพ่ไทย TCG (PaiThai TCG)

export type CardType = 'monster' | 'spell' | 'trap' | 'ritual';

export type ElementId =
  | 'fire'      // อัคนี 🔥 (ชนะ วายุ)
  | 'water'     // วารี 💧 (ชนะ อัคนี)
  | 'earth'     // ปฐวี 🌿 (ชนะ อาสนี)
  | 'wind'      // วายุ 💨 (ชนะ ปฐวี)
  | 'lightning' // อาสนี ⚡ (ชนะ วารี)
  | 'dark'      // ตมะ 🌑 (ชนะ ศูนยตา)
  | 'light'     // โชติ ✨ (ชนะ ตมะ)
  | 'void';     // ศูนยตา 🌀 (ชนะ โชติ)

export type AnimalTribeId = 'bird' | 'insect' | 'plant' | 'reptile' | 'largeBeast';
export type SpiritTribeId = 'demon' | 'ghost' | 'deva';
export type HumanTribeId =
  | 'warrior'
  | 'astrologer'
  | 'healer'
  | 'royalty'
  | 'performer'
  | 'hunter'
  | 'merchant'
  | 'artisan';

export type TribeId = AnimalTribeId | SpiritTribeId | HumanTribeId;

export type RarityId =
  | 'common'  // ⬜ สามัญ (~55%)
  | 'copper'  // 🟫 ทองแดง (~25%)
  | 'silver'  // ⬜ เงิน (~12%)
  | 'gold'    // 🟨 ทอง (~6%)
  | 'emerald' // 💠 มรกต (~1.5%)
  | 'divine'; // 🌟 เทพ (~0.5%, 1 ใบ/เซ็ต)

export type SummonType =
  | 'normal'  // Level 1-4 วางได้เลย
  | 'tribute' // Level 5-6 สังเวย 1 / Level 7+ สังเวย 2
  | 'ritual'  // การ์ดพิธี + มอนสเตอร์ ritual + เครื่องสังเวย
  | 'fusion'  // มอนสเตอร์ 2 ตัว + คาถาผสาน
  | 'spirit'; // อัญเชิญจาก Graveyard ด้วย "น้ำมนต์"

export type EvolutionPathType = 'ritual' | 'xp' | 'fusion' | 'branch';

export interface EvolutionInfo {
  path: EvolutionPathType;
  stage?: number;
  maxStage?: number;
  evolvesFrom?: string[];          // Card IDs
  evolvesTo?: string | string[];   // รองรับการแตกสายหลายทาง (Multi-branch Evolution)
  conditionText: string;
  ritualCardId?: string;
  fusionSpellId?: string;
}

export interface BaseCard {
  id: string;
  setCode: string;
  name: string;
  nameEn: string;
  type: CardType;
  element: ElementId;
  secondaryElements?: ElementId[];
  rarity: RarityId;
  image: string;
  effectText: string;
  flavorText: string;
  groupTag: 'xp-hunter' | 'ritual-faith' | 'himmapan-fusion' | 'warrior-beast' | 'spell-trap' | 'promo' | 'celestial-court';
  evolution?: EvolutionInfo;
}

export interface MonsterCardData extends BaseCard {
  type: 'monster';
  level: number;
  tribe: TribeId;
  secondaryTribe?: TribeId;
  summonType: SummonType;
  tributeCount?: number;
  atk: number;
  def: number;
}

export interface SpellCardData extends BaseCard {
  type: 'spell';
  spellSubtype: 'normal' | 'continuous' | 'field' | 'equip' | 'fusion' | 'spirit';
  spellSubtypeName: string;
}

export interface TrapCardData extends BaseCard {
  type: 'trap';
  trapSubtype: 'normal' | 'counter' | 'continuous';
  trapSubtypeName: string;
}

export interface RitualCardData extends BaseCard {
  type: 'ritual';
  targetMonsterId: string;
  requiredLevel: number;
}

export type CardData =
  | MonsterCardData
  | SpellCardData
  | TrapCardData
  | RitualCardData;

