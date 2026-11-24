import { BasePayoutAllocationStrategy } from './payout-allocation.interface.js';

export class ManualOverrideStrategy extends BasePayoutAllocationStrategy {
  constructor() {
    super('MANUAL_OVERRIDE');
  }

  allocate(eligibleGrns, context) {
    const entries = [];
    let totalAllocatedWeight = 0;
    let totalAllocatedAmount = 0;

    const grnMap = new Map(eligibleGrns.map((g) => [g.grnId, g]));
    const overrides = context.manualOverrides || [];

    for (const override of overrides) {
      const grn = grnMap.get(override.grnId);
      if (!grn) continue;

      const overrideWeight = parseFloat(override.amountOrWeight) || 0;
      if (overrideWeight <= 0) continue;

      const rate = parseFloat(grn.appliedRatePerUnit) || 0;
      const amount = overrideWeight * rate;

      const prevAllocated = parseFloat(grn.fifoAllocatedWeight) || 0;
      const newTotal = prevAllocated + overrideWeight;
      const netBillable = parseFloat(grn.netBillableWeight) || 0;
      const isFullySettled = newTotal >= netBillable;

      entries.push({
        grnId: grn.grnId,
        grnNumber: grn.grnNumber,
        farmerId: grn.farmerId,
        allocatedWeight: overrideWeight.toFixed(2),
        allocatedAmount: amount.toFixed(2),
        newTotalAllocatedWeight: newTotal.toFixed(2),
        isFullySettled,
      });

      totalAllocatedWeight += overrideWeight;
      totalAllocatedAmount += amount;
    }

    const target = parseFloat(context.targetWeight) || totalAllocatedWeight;
    const remaining = Math.max(0, target - totalAllocatedWeight);

    return {
      strategyType: this.strategyType,
      totalTargetWeight: String(context.targetWeight),
      totalAllocatedWeight: totalAllocatedWeight.toFixed(2),
      totalAllocatedAmount: totalAllocatedAmount.toFixed(2),
      unallocatedRemainingWeight: remaining.toFixed(2),
      entries,
    };
  }
}
