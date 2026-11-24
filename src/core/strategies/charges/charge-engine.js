import { FlatChargeStrategy } from './flat-charge.strategy.js';
import { PercentageChargeStrategy } from './percentage-charge.strategy.js';
import { PerUnitWeightChargeStrategy } from './per-unit-weight-charge.strategy.js';

export class ChargeEngine {
  constructor() {
    this.strategies = new Map([
      ['FLAT', new FlatChargeStrategy()],
      ['PERCENTAGE', new PercentageChargeStrategy()],
      ['PER_UNIT_WEIGHT', new PerUnitWeightChargeStrategy()],
    ]);
  }

  validateRoleAllowed(chargeDefinition, actorRole) {
    if (!Array.isArray(chargeDefinition.allowedRoles)) {
      return false;
    }
    return chargeDefinition.allowedRoles.includes(actorRole);
  }

  calculateSingleCharge(chargeDefinition, context, actor = {}) {
    const strategy = this.strategies.get(chargeDefinition.calculationType);
    if (!strategy) {
      throw new Error(`Unsupported calculation type: ${chargeDefinition.calculationType}`);
    }

    if (actor.role && !this.validateRoleAllowed(chargeDefinition, actor.role)) {
      throw new Error(
        `Role ${actor.role} is not authorized to attach charge ${chargeDefinition.code}`
      );
    }

    const calculated = strategy.calculate(
      {
        id: chargeDefinition.id,
        code: chargeDefinition.code,
        name: chargeDefinition.name,
        direction: chargeDefinition.direction,
        calculationType: chargeDefinition.calculationType,
        visibility: chargeDefinition.visibility,
        stage: chargeDefinition.stage,
        rate: String(context.rateOverride ?? chargeDefinition.defaultRate),
      },
      context
    );

    return {
      chargeDefinitionId: chargeDefinition.id,
      nameSnapshot: chargeDefinition.name,
      direction: chargeDefinition.direction,
      visibility: chargeDefinition.visibility,
      calculationType: chargeDefinition.calculationType,
      rateApplied: calculated.rateApplied,
      calculatedAmount: calculated.calculatedAmount,
      addedByUserId: actor.userId || null,
      addedByRole: actor.role || null,
    };
  }

  processInboundGrnCharges(definitions, context, actor) {
    const snapshots = [];
    let additionsTotal = 0;
    let deductionsTotal = 0;

    for (const def of definitions) {
      if (def.stage !== 'INBOUND_GRN') continue;
      const snapshot = this.calculateSingleCharge(def, context, actor);
      const amount = parseFloat(snapshot.calculatedAmount) || 0;

      if (snapshot.direction === 'ADDITION') {
        additionsTotal += amount;
      } else {
        deductionsTotal += amount;
      }

      snapshots.push(snapshot);
    }

    const gross = parseFloat(context.baseAmount) || 0;
    const netPayable = gross + additionsTotal - deductionsTotal;

    return {
      snapshots,
      additionsTotal: additionsTotal.toFixed(2),
      deductionsTotal: deductionsTotal.toFixed(2),
      netPayableAmount: netPayable.toFixed(2),
    };
  }

  buildCatalogPrice(baseProcurementPrice, activeCatalogDefinitions, context) {
    let finalBuyerUnitPrice = parseFloat(baseProcurementPrice) || 0;
    const marginSnapshots = [];

    for (const def of activeCatalogDefinitions) {
      if (def.stage !== 'CATALOG_PRICE' || !def.isActive) continue;

      const snapshot = this.calculateSingleCharge(
        def,
        {
          ...context,
          baseAmount: String(finalBuyerUnitPrice),
        },
        { role: 'ADMIN' }
      );

      const amount = parseFloat(snapshot.calculatedAmount) || 0;
      if (snapshot.direction === 'ADDITION') {
        finalBuyerUnitPrice += amount;
      } else {
        finalBuyerUnitPrice -= amount;
      }

      marginSnapshots.push(snapshot);
    }

    return {
      displayedUnitPrice: finalBuyerUnitPrice.toFixed(2),
      marginSnapshots,
    };
  }

  processOutboundOrderCharges(definitions, context, actor = {}) {
    const publicInvoiceCharges = [];
    const hiddenAccountingCharges = [];
    let publicChargesTotal = 0;

    for (const def of definitions) {
      if (def.stage !== 'OUTBOUND_ORDER' || !def.isActive) continue;

      const snapshot = this.calculateSingleCharge(def, context, actor);
      const amount = parseFloat(snapshot.calculatedAmount) || 0;

      if (snapshot.visibility === 'PUBLIC') {
        publicInvoiceCharges.push(snapshot);
        if (snapshot.direction === 'ADDITION') {
          publicChargesTotal += amount;
        } else {
          publicChargesTotal -= amount;
        }
      } else {
        hiddenAccountingCharges.push(snapshot);
      }
    }

    const subtotal = parseFloat(context.baseAmount) || 0;
    const totalOrderAmount = subtotal + publicChargesTotal;

    return {
      publicInvoiceCharges,
      hiddenAccountingCharges,
      publicChargesTotal: publicChargesTotal.toFixed(2),
      totalOrderAmount: totalOrderAmount.toFixed(2),
      allSnapshots: [...publicInvoiceCharges, ...hiddenAccountingCharges],
    };
  }
}

export const globalChargeEngine = new ChargeEngine();
