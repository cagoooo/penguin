// Single source of truth for all shop items.
// Effects are split into "icon metadata" (rendered in App.tsx with lucide icons) and
// "effect application" (runtime mutation of the gameRef). The previous code duplicated
// the same array verbatim in 4 places — DON'T do that again.

export type ShopItemId =
  | 'timer'
  | 'propeller'
  | 'skateboard'
  | 'life'
  | 'magnet'
  | 'shield'
  | 'nitro'
  | 'detector'
  | 'timer2'
  | 'boots'
  | 'scarf'
  | 'compass'
  | 'bait'
  | 'timering'
  | 'antigravity'
  | 'crown';

export type ShopItemTiming = 'immediate' | 'next-level';

export interface ShopItemMeta {
  id: ShopItemId;
  name: string;
  /** Icon component name from lucide-react. App.tsx maps this to the actual element. */
  iconName:
    | 'Clock'
    | 'Maximize'
    | 'Zap'
    | 'Heart'
    | 'Shield'
    | 'Search'
    | 'ChevronRight'
    | 'Wind'
    | 'Compass'
    | 'Fish'
    | 'Timer'
    | 'Rocket'
    | 'Trophy';
  /** Tailwind classes applied to the icon element. */
  iconClass: string;
  /** Optional extra inline transform (e.g. boots' rotation). */
  iconExtra?: string;
  desc: string;
  price: number;
  timing: ShopItemTiming;
}

export const ALL_SHOP_ITEMS: readonly ShopItemMeta[] = [
  { id: 'timer', name: '黃金碼表', iconName: 'Clock', iconClass: 'w-10 h-10 text-blue-400', desc: '很好。你想買什麼？\n\n效果：【立即生效】增加 10 秒計時。', price: 10000, timing: 'immediate' },
  { id: 'propeller', name: '特製螺旋槳', iconName: 'Maximize', iconClass: 'w-10 h-10 text-purple-400', desc: '太棒了。這可是好貨。\n\n效果：【下關生效】讓下一次飛行持續時間翻倍。', price: 4000, timing: 'next-level' },
  { id: 'skateboard', name: '噴射滑板', iconName: 'Zap', iconClass: 'w-10 h-10 text-green-400', desc: '確定要這個？這玩意兒很快。\n\n效果：【下關生效】地面時速翻倍，直到發生碰撞。', price: 8000, timing: 'next-level' },
  { id: 'life', name: '企鵝娃娃', iconName: 'Heart', iconClass: 'w-10 h-10 text-red-400', desc: '很聰明的選擇。\n\n效果：【立即生效】獲得額外生命。', price: 20000, timing: 'immediate' },
  { id: 'magnet', name: '磁力項圈', iconName: 'Zap', iconClass: 'w-10 h-10 text-cyan-300', desc: '省力好幫手。\n\n效果：【下關生效】自動吸引所有魚片，持續 30 秒。', price: 12000, timing: 'next-level' },
  { id: 'shield', name: '冰原護盾', iconName: 'Shield', iconClass: 'w-10 h-10 text-blue-200', desc: '安全至上。\n\n效果：【下關生效】抵擋下一次碰撞造成的減速。', price: 18000, timing: 'next-level' },
  { id: 'nitro', name: '氮氣噴發', iconName: 'Zap', iconClass: 'w-10 h-10 text-orange-500', desc: '油門踩到底！\n\n效果：【下關生效】啟動 5 秒極速衝刺且無敵狀態。', price: 25000, timing: 'next-level' },
  { id: 'detector', name: '高級偵測器', iconName: 'Search', iconClass: 'w-10 h-10 text-yellow-200', desc: '尋寶專用。\n\n效果：【下關生效】該關卡路徑中金魚出現率增加。', price: 15000, timing: 'next-level' },
  { id: 'timer2', name: '白金碼表', iconName: 'Clock', iconClass: 'w-10 h-10 text-white', desc: '時間大師。\n\n效果：【立即生效】增加 30 秒計時。', price: 35000, timing: 'immediate' },
  { id: 'boots', name: '重型雪靴', iconName: 'ChevronRight', iconClass: 'w-10 h-10 text-stone-400', iconExtra: '-rotate-90', desc: '踏破艱險。\n\n效果：【下關生效】碰撞冰縫不再跌倒，僅輕微減速。', price: 45000, timing: 'next-level' },
  { id: 'scarf', name: '流線領巾', iconName: 'Wind', iconClass: 'w-10 h-10 text-sky-300', desc: '如風一般。\n\n效果：【下關生效】永久提升 10% 加速度與最速上限。', price: 50000, timing: 'next-level' },
  { id: 'compass', name: '極光羅盤', iconName: 'Compass', iconClass: 'w-10 h-10 text-indigo-400', desc: '空間跳躍。\n\n效果：【立即生效】縮短該次任務 1000m 的距離。', price: 65000, timing: 'immediate' },
  { id: 'bait', name: '神奇魚餌', iconName: 'Fish', iconClass: 'w-10 h-10 text-red-300', desc: '點石成金。\n\n效果：【下關生效】該關卡剩餘所有魚獲得 3 倍積分。', price: 80000, timing: 'next-level' },
  { id: 'timering', name: '克羅諾斯之戒', iconName: 'Timer', iconClass: 'w-10 h-10 text-amber-500', desc: '靜止的世界。 \n\n效果：【下關生效】凍結計時鐘 15 秒且維持移動量。', price: 100000, timing: 'next-level' },
  { id: 'antigravity', name: '反重力引擎', iconName: 'Rocket', iconClass: 'w-10 h-10 text-rose-500', desc: '飛躍南極。\n\n效果：【下關生效】直接獲得 20 秒長效飛行。', price: 150000, timing: 'next-level' },
  { id: 'crown', name: '探險王之冠', iconName: 'Trophy', iconClass: 'w-10 h-10 text-yellow-300 shadow-lg', desc: '無上榮耀。\n\n效果：【下關生效】永久獲得 3 倍的分數與距離加成。', price: 500000, timing: 'next-level' },
];

export function getShopItem(id: ShopItemId | string | null): ShopItemMeta | undefined {
  return ALL_SHOP_ITEMS.find(i => i.id === id);
}

/** Items unlocked at a given level. God Mode unlocks everything. */
export function shopItemsForLevel(level: number, godMode: boolean): ShopItemMeta[] {
  if (godMode) return [...ALL_SHOP_ITEMS];
  return ALL_SHOP_ITEMS.slice(0, Math.min(16, 4 + level));
}
