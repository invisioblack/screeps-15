import { Exclude } from "class-transformer";
import { SpeculativeMinion } from "TaskRequests/SpeculativeMinion";
import { TaskPrerequisite } from "TaskRequests/TaskPrerequisite";
import { HarvestTask } from "TaskRequests/types/HarvestTask";
import { WithdrawTask } from "TaskRequests/types/WithdrawTask";

/**
 * Checks if minion has capacity to carry resources
 * If not, fails
 * @param quantity Get reference when prerequisite is checked
 */
export class MustHaveCarryCapacity extends TaskPrerequisite {
    met(minion: SpeculativeMinion) {
        return minion.capacity - minion.capacityUsed > 0;
    }
    toMeet() {
        return null;
    }
}