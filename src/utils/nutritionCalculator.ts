export interface NutritionPer100g {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
}

export interface UnitOptionLike {
  name: string;
  gramsPerUnit: number;
}

export interface NutritionCalculationResult {
  totalWeight: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  macroRatio: {
    protein: number;
    carbs: number;
    fats: number;
  };
}

export function isGramUnit(unitName: string | null | undefined): boolean {
  return !unitName || ["g", "gram", "grams", "克"].includes(unitName.toLowerCase());
}

export function resolveGramsPerUnit(
  unitName: string | null | undefined,
  units: UnitOptionLike[]
): number | null {
  if (isGramUnit(unitName)) {
    return 1;
  }

  const match = units.find((unit) => unit.name === unitName);
  return match ? match.gramsPerUnit : null;
}

export function calculateNutritionFromWeight(
  amount: number,
  gramsPerUnit: number,
  nutrition: NutritionPer100g
): NutritionCalculationResult {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const safeGramsPerUnit = Number.isFinite(gramsPerUnit) ? gramsPerUnit : 0;
  const totalWeight = Number((safeAmount * safeGramsPerUnit).toFixed(2));

  const totalCalories = Number(((totalWeight / 100) * nutrition.caloriesPer100g).toFixed(1));
  const totalProtein = Number(((totalWeight / 100) * nutrition.proteinPer100g).toFixed(1));
  const totalCarbs = Number(((totalWeight / 100) * nutrition.carbsPer100g).toFixed(1));
  const totalFats = Number(((totalWeight / 100) * nutrition.fatsPer100g).toFixed(1));

  const macroCalories = {
    protein: totalProtein * 4,
    carbs: totalCarbs * 4,
    fats: totalFats * 9,
  };
  const totalMacroCalories = macroCalories.protein + macroCalories.carbs + macroCalories.fats;

  return {
    totalWeight,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFats,
    macroRatio: totalMacroCalories > 0
      ? {
          protein: Number(((macroCalories.protein / totalMacroCalories) * 100).toFixed(1)),
          carbs: Number(((macroCalories.carbs / totalMacroCalories) * 100).toFixed(1)),
          fats: Number(((macroCalories.fats / totalMacroCalories) * 100).toFixed(1)),
        }
      : { protein: 0, carbs: 0, fats: 0 },
  };
}
