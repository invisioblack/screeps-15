import { TaskRequest } from "tasks/TaskRequest";
import { TransferTask } from "tasks/types/TransferTask";
import { getTransferEnergyRemaining } from "utils/gameObjectSelectors";
import { Manager } from "./Manager";

export class DefenseManager extends Manager {
    towers: StructureTower[] = [];
    init = (room: Room) => {
        this.towers = global.analysts.defense.getTowers(room);
        let targets = global.analysts.defense.getPrioritizedAttackTargets(room);
        let healTargets = global.analysts.defense.getPrioritizedHealTargets(room);
        let repairTargets = global.analysts.defense.getPrioritizedRepairTargets(room);

        this.towers.forEach(t => {
            // Request energy, if needed
            let e = getTransferEnergyRemaining(t);
            if (e) {
                if (e < 500) {
                    global.supervisors.task.submit(new TaskRequest(t.id, new TransferTask(t), 5, e));
                } else {
                    global.supervisors.task.submit(new TaskRequest(t.id, new TransferTask(t), 9, e));
                }
            }

            // Simple priorities

            if (targets.length > 0) {
                t.attack(targets[0]);
            } else if (healTargets.length > 0) {
                t.heal(healTargets[0]);
            } else if (repairTargets.length > 0) {
                t.repair(repairTargets[0]);
            }
        })
    }
}