import { BehaviorResult, Blackboard } from "BehaviorTree/Behavior";

import { byId } from "utils/gameObjectSelectors";

/**
 * Relies on Blackboard.buildSite to be populated by createConstructionSite
 */
export const ifBuildIsNotFinished = () => (creep: Creep, bb: Blackboard) => {
    if (byId(bb.buildSite?.id)) return BehaviorResult.FAILURE;

    return BehaviorResult.SUCCESS;
}
