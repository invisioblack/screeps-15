import { Exclude } from "class-transformer";
import { SpeculativeMinion } from "tasks/SpeculativeMinion";
import { Task } from "tasks/Task";
import { TaskPrerequisite } from "tasks/TaskPrerequisite";
import { HarvestTask } from "tasks/types/HarvestTask";
import { WithdrawTask } from "tasks/types/WithdrawTask";

/**
 * Checks if minion is full or has enough energy to meet quantity
 * If not, creates tasks to harvest or withdraw energy
 * @param quantity Get reference when prerequisite is checked
 */
export class MustHaveEnergy extends TaskPrerequisite {
    constructor(
        public quantity: number
    ) { super(); }

    met(minion: SpeculativeMinion) {
        if (this.quantity <= 0) return false;
               // Minion can carry energy, and
        return minion.capacity > 0 &&
               // Minion has a full tank or enough to meet `quantity`
               minion.capacityUsed >= Math.max(this.quantity, minion.capacity)
    };
    toMeet(minion: SpeculativeMinion) {
        if (minion.capacity === 0) return null; // Cannot carry energy
        // TODO: Check if source/container has enough energy to fill minion
        // Can get energy from harvesting
        let sources = global.analysts.source.getUntappedSources(minion.creep.room)
                                            .map(source => new HarvestTask(source));
        // Can get energy from withdrawing
        let containers = global.analysts.logistics.getAllSources(minion.creep.room)
                                                  .map(source => new WithdrawTask(source));
        return [...sources, ...containers];
    }
}