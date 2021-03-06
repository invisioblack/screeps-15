import { BehaviorResult, Blackboard } from "BehaviorTree/Behavior";
import { CachedCreep, CachedStructure } from "WorldState/";

export const transferEnergy = (target?: CachedCreep|CachedStructure<AnyStoreStructure>, amount?: number) => (creep: CachedCreep, bb: Blackboard) => {
    if (!target || !target.gameObj || target.capacityFree === 0) return BehaviorResult.FAILURE;

    let result = creep.gameObj.transfer(target.gameObj, RESOURCE_ENERGY, amount)

    return (result === OK || result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_FULL) ? BehaviorResult.SUCCESS : BehaviorResult.FAILURE
}
