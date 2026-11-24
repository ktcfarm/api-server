import { BaseChargeCalculationStrategy } from './charge-calculation.interface.js';

export class PerUnitWeightChargeStrategy extends BaseChargeCalculationStrategy {
  constructor() {
    super('PER_UNIT_WEIGHT');
  }

  calculate(definition, context) {
    const qty = parseFloat(context.quantity) || 0;
    const ratePerUnit = parseFloat(definition.rate) || 0;
    const calculated = (qty * ratePerUnit).toFixed(2);

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
