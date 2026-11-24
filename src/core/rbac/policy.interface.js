export class BasePolicy {
  constructor(resource) {
    if (new.target === BasePolicy) {
      throw new TypeError('Cannot construct BasePolicy instances directly');
    }
    this.resource = resource;
  }

  evaluate(_context) {
    throw new Error('Method evaluate() must be implemented');
  }
}
