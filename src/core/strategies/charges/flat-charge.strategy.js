import { BaseChargeCalculationStrategy } from './charge-calculation.interface.js';

export class FlatChargeStrategy extends BaseChargeCalculationStrategy {
  constructor() {
    super('FLAT');
  }

  calculate(definition, _context) {
    const rateValue = parseFloat(definition.rate) || 0;
    const calculated = rateValue.toFixed(2);

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
