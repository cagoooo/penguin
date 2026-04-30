import { describe, it, expect } from 'vitest';
import { ALL_SHOP_ITEMS, getShopItem, shopItemsForLevel } from './items';

describe('shop items', () => {
  it('contains 19 items (16 original + 3 new from 6-2)', () => {
    expect(ALL_SHOP_ITEMS).toHaveLength(19);
  });

  it('every item has unique id, name, positive price', () => {
    const ids = new Set<string>();
    for (const item of ALL_SHOP_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThan(0);
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
    }
    expect(ids.size).toBe(ALL_SHOP_ITEMS.length);
  });

  it('every item has either immediate or next-level timing', () => {
    for (const item of ALL_SHOP_ITEMS) {
      expect(['immediate', 'next-level']).toContain(item.timing);
    }
  });

  it('getShopItem returns the right item by id', () => {
    expect(getShopItem('timer')?.price).toBe(10000);
    expect(getShopItem('crown')?.price).toBe(500000);
    expect(getShopItem('crown')?.timing).toBe('next-level');
    expect(getShopItem('life')?.timing).toBe('immediate');
  });

  it('getShopItem returns undefined for unknown / null', () => {
    expect(getShopItem('not-real')).toBeUndefined();
    expect(getShopItem(null)).toBeUndefined();
    expect(getShopItem('null-3')).toBeUndefined();
  });

  it('shopItemsForLevel unlocks 4+level items at non-god mode', () => {
    expect(shopItemsForLevel(1, false)).toHaveLength(5);
    expect(shopItemsForLevel(2, false)).toHaveLength(6);
    expect(shopItemsForLevel(15, false)).toHaveLength(ALL_SHOP_ITEMS.length); // all unlocked at L15
    expect(shopItemsForLevel(99, false)).toHaveLength(ALL_SHOP_ITEMS.length); // capped
  });

  it('shopItemsForLevel returns all items in god mode', () => {
    expect(shopItemsForLevel(1, true)).toHaveLength(ALL_SHOP_ITEMS.length);
    expect(shopItemsForLevel(99, true)).toHaveLength(ALL_SHOP_ITEMS.length);
  });

  it('crown remains the most expensive item', () => {
    const crown = ALL_SHOP_ITEMS.find(i => i.id === 'crown');
    expect(crown).toBeTruthy();
    const prices = ALL_SHOP_ITEMS.map(i => i.price);
    expect(Math.max(...prices)).toBe(crown!.price);
  });
});
