import { describe, it, expect } from 'vitest';
import { ALL_SHOP_ITEMS, getShopItem, shopItemsForLevel } from './items';

describe('shop items', () => {
  it('contains exactly 16 items', () => {
    expect(ALL_SHOP_ITEMS).toHaveLength(16);
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
    expect(ids.size).toBe(16);
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
    expect(shopItemsForLevel(12, false)).toHaveLength(16);
    expect(shopItemsForLevel(99, false)).toHaveLength(16); // capped
  });

  it('shopItemsForLevel returns all items in god mode', () => {
    expect(shopItemsForLevel(1, true)).toHaveLength(16);
    expect(shopItemsForLevel(99, true)).toHaveLength(16);
  });

  it('crown is always last (most expensive)', () => {
    const last = ALL_SHOP_ITEMS[ALL_SHOP_ITEMS.length - 1];
    expect(last.id).toBe('crown');
    const prices = ALL_SHOP_ITEMS.map(i => i.price);
    expect(Math.max(...prices)).toBe(last.price);
  });
});
