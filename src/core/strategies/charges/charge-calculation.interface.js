export class BaseChargeCalculationStrategy {
  constructor(calculationType) {
    if (new.target === BaseChargeCalculationStrategy) {
      throw new TypeError('Cannot construct BaseChargeCalculationStrategy instances directly');
    }
    this.calculationType = calculationType;
  }

  calculate(_definition, _context) {
    throw new Error('Method calculate() must be implemented');
  }
}
