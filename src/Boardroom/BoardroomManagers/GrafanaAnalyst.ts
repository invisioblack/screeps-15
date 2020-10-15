import { BoardroomManager } from "Boardroom/BoardroomManager";
import { Office } from "Office/Office";
import { ControllerAnalyst } from "./ControllerAnalyst";
import { LogisticsAnalyst } from "./LogisticsAnalyst";
import { SalesAnalyst } from "./SalesAnalyst";
import { StatisticsAnalyst } from "./StatisticsAnalyst";


export class GrafanaAnalyst extends BoardroomManager {
    deltas: {
        [id: string]: {
            building: number,
            repairing: number
        }
    } = {};
    plan() {
        this.boardroom.offices.forEach(office => {
            this.deltas[office.name] = {
                building: 0,
                repairing: 0
            };

            [office.center, ...office.territories]
                .map(t => t.room)
                .forEach(room => {
                    if (!room) return;
                    room.getEventLog().forEach(event => {
                        switch (event.event) {
                            case EVENT_BUILD:
                                this.deltas[office.name].building += event.data.energySpent;
                                break;
                            case EVENT_REPAIR:
                                this.deltas[office.name].repairing += event.data.energySpent;
                                break;
                        }
                    })
                })
        });
    }
    pipelineMetrics(office: Office) {
        let controllerAnalyst = this.boardroom.managers.get('ControllerAnalyst') as ControllerAnalyst;
        let logisticsAnalyst = this.boardroom.managers.get('LogisticsAnalyst') as LogisticsAnalyst;
        let salesAnalyst = this.boardroom.managers.get('SalesAnalyst') as SalesAnalyst;
        let statisticsAnalyst = this.boardroom.managers.get('StatisticsAnalyst') as StatisticsAnalyst;

        let upgradeDepot = controllerAnalyst.getDesignatedUpgradingLocations(office)?.container
        let storage = logisticsAnalyst.getStorage(office);

        let fleet = logisticsAnalyst.getCarriers(office);
        let mobileDepots = logisticsAnalyst.depots.get(office.name) ?? [];

        return {
            sourcesLevel: salesAnalyst.getFranchiseLocations(office).reduce((sum, source) => (sum + (source.source?.energy || 0)), 0),
            sourcesMax: salesAnalyst.getFranchiseLocations(office).reduce((sum, source) => (sum + (source.source?.energyCapacity || 0)), 0),
            mineContainersLevel: salesAnalyst.getFranchiseLocations(office)
                .reduce((sum, mine) => (sum + (mine.surplus || 0)), 0),
            mineContainersMax: salesAnalyst.getFranchiseLocations(office)
                .reduce((sum, mine) => (sum + (mine.container?.store.getCapacity() || 0)), 0),
            storageLevel: storage.reduce((sum, container) => (sum + (container.store.energy || 0)), 0),
            storageMax: storage.reduce((sum, container) => (sum + (container.store.getCapacity() || 0)), 0),
            upgradeDepotLevel: upgradeDepot?.store.energy || 0,
            upgradeDepotMax: upgradeDepot?.store.getCapacity() || 0,
            carrierFleetLevel: fleet.reduce((sum, creep) => sum + creep.store.getUsedCapacity(RESOURCE_ENERGY), 0),
            carrierFleetMax: fleet.reduce((sum, creep) => sum + creep.store.getCapacity(RESOURCE_ENERGY), 0),
            mobileDepotsLevel: mobileDepots.reduce((sum, creep) => sum + creep.store.getUsedCapacity(RESOURCE_ENERGY), 0),
            mobileDepotsMax: mobileDepots.reduce((sum, creep) => sum + creep.store.getCapacity(RESOURCE_ENERGY), 0),
            roomEnergyLevel: office.center.room.energyAvailable,
            roomEnergyMax: office.center.room.energyCapacityAvailable,
            buildDelta: this.deltas[office.name].building,
            repairDelta: this.deltas[office.name].repairing,
            pipelineThroughput: statisticsAnalyst.metrics.get(office.name)?.logisticsThroughput.mean() ?? 0
        }
    }
    cleanup() {
        const stats: {[id: string]: {
            pipelineMetrics: {
                sourcesLevel: number,
                mineContainersLevel: number
            },
            controllerProgress: number;
            controllerProgressTotal: number;
            controllerLevel: number; }
        } = {};
        this.boardroom.offices.forEach(office => {
            if (office.center.room.controller?.my) {
                stats[office.name] = {
                    pipelineMetrics: this.pipelineMetrics(office),
                    controllerProgress: office.center.room.controller.progress,
                    controllerProgressTotal: office.center.room.controller.progressTotal,
                    controllerLevel: office.center.room.controller.level,
                }
            }
        })
        // Reset stats object
        Memory.stats = {
            gcl: {
                progress: Game.gcl.progress,
                progressTotal: Game.gcl.progressTotal,
                level: Game.gcl.level,
            },
            offices: stats,
            cpu: {
                bucket: Game.cpu.bucket,
                limit: Game.cpu.limit,
                used: Game.cpu.getUsed(),
            },
            time: Game.time,
        };
    }
}
