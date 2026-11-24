import { BasePayoutAllocationStrategy } from './payout-allocation.interface.js';

export class FifoAllocationStrategy extends BasePayoutAllocationStrategy {
  constructor() {
    super('FIFO_SETTLEMENT');
  }

  allocate(eligibleGrns, context) {
    let remainingTarget = parseFloat(context.targetWeight) || 0;
    const entries = [];
    let totalAllocatedWeight = 0;
    let totalAllocatedAmount = 0;

    const sortedGrns = [...eligibleGrns].sort(
      (a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime()
    );

    for (const grn of sortedGrns) {
      if (remainingTarget <= 0) break;

      const unallocated = parseFloat(grn.unallocatedWeight) || 0;
      if (unallocated <= 0) continue;

      const weightToAllocate = Math.min(unallocated, remainingTarget);
      const rate = parseFloat(grn.appliedRatePerUnit) || 0;
      const amountToAllocate = weightToAllocate * rate;

      const prevAllocated = parseFloat(grn.fifoAllocatedWeight) || 0;
      const newTotal = prevAllocated + weightToAllocate;
      const netBillable = parseFloat(grn.netBillableWeight) || 0;
      const isFullySettled = newTotal >= netBillable;

      entries.push({
        grnId: grn.grnId,
        grnNumber: grn.grnNumber,
        farmerId: grn.farmerId,
        allocatedWeight: weightToAllocate.toFixed(2),
        allocatedAmount: amountToAllocate.toFixed(2),
        newTotalAllocatedWeight: newTotal.toFixed(2),
        isFullySettled,
      });

      remainingTarget -= weightToAllocate;
      totalAllocatedWeight += weightToAllocate;
      totalAllocatedAmount += amountToAllocate;
    }

    return {
      strategyType: this.strategyType,
      totalTargetWeight: String(context.targetWeight),
      totalAllocatedWeight: totalAllocatedWeight.toFixed(2),
      totalAllocatedAmount: totalAllocatedAmount.toFixed(2),
      unallocatedRemainingWeight: Math.max(0, remainingTarget).toFixed(2),
      entries,
    };
  }
}
