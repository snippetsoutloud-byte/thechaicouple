// Item name constants - use these instead of hardcoding strings
export const ITEM_NAMES = {
  CHAI: "Special Chai",
  BUN: "Bun Maska",
  TIRAMISU: "Tiramisu",
  MILK_BUN: "Premium Milk Bun",
  // Legacy support for old data
  CHAI_LEGACY: "Irani Chai",
  BUN_LEGACY: "Bun",
  MILK_BUN_LEGACY: "Milk Bun",
};

// Helper function to check if an item is chai (handles both new and legacy names)
export function isChai(itemName = "") {
  return (
    itemName === ITEM_NAMES.CHAI ||
    itemName === ITEM_NAMES.CHAI_LEGACY
  );
}

// Helper function to check if an item is bun (handles new and legacy names)
export function isBun(itemName = "") {
  return itemName === ITEM_NAMES.BUN || itemName === ITEM_NAMES.BUN_LEGACY;
}

// Helper function to check if an item is tiramisu
export function isTiramisu(itemName = "") {
  return itemName === ITEM_NAMES.TIRAMISU;
}

// Helper function to check if an item is milk bun (handles new and legacy names)
export function isMilkBun(itemName = "") {
  return (
    itemName === ITEM_NAMES.MILK_BUN ||
    itemName === ITEM_NAMES.MILK_BUN_LEGACY
  );
}

