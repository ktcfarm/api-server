import { BaseChargeCalculationStrategy } from './charge-calculation.interface.js';

export class PercentageChargeStrategy extends BaseChargeCalculationStrategy {
  constructor() {
    super('PERCENTAGE');
  }

  calculate(definition, context) {
    const base = parseFloat(context.baseAmount) || 0;
    const percentage = parseFloat(definition.rate) || 0;
    const calculated = ((base * percentage) / 100).toFixed(2);

    return {
      chargeDefinitionId: definition.id,
      code: definition.code,
      nameSnapshot: definition.name,
      visibility: definition.visibility,
      calculationType: this.calculationType,
      direction: definition.direction,
      rateApplied: String(definition.rate),
      calculatedAmount: calculated,
    };
  }
}
