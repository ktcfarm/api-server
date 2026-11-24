export class BasePayoutAllocationStrategy {
  constructor(strategyType) {
    if (new.target === BasePayoutAllocationStrategy) {
      throw new TypeError('Cannot construct BasePayoutAllocationStrategy instances directly');
    }
    this.strategyType = strategyType;
  }

  allocate(_eligibleGrns, _context) {
    throw new Error('Method allocate() must be implemented');
  }
}
