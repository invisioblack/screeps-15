import { HRAnalyst } from "Boardroom/BoardroomManagers/HRAnalyst";
import { LogisticsAnalyst } from "Boardroom/BoardroomManagers/LogisticsAnalyst";
import { SalesAnalyst } from "Boardroom/BoardroomManagers/SalesAnalyst";
import { StatisticsAnalyst } from "Boardroom/BoardroomManagers/StatisticsAnalyst";
import { LogisticsRequest, ResupplyRequest } from "Logistics/LogisticsRequest";
import { LogisticsRoute } from "Logistics/LogisticsRoute";
import { LogisticsSource } from "Logistics/LogisticsSource";
import { MinionRequest, MinionTypes } from "MinionRequests/MinionRequest";
import { OfficeManager, OfficeManagerStatus } from "Office/OfficeManager";
import { getFreeCapacity } from "utils/gameObjectSelectors";
import { Bar, Meters } from "Visualizations/Meters";

export class LogisticsManager extends OfficeManager {
    storage?: StructureStorage;
    extensions: StructureExtension[] = [];
    spawns: StructureSpawn[] = [];
    carriers: Creep[] = [];

    sources = new Map<RoomPosition, LogisticsSource>();
    requests = new Map<string, LogisticsRequest>();
    routes = new Map<Creep, LogisticsRoute>();

    submit(requestId: string, request: LogisticsRequest) {
        let req = this.requests.get(requestId);
        if (!req || req.priority < request.priority) {
            if (req) req.completed = true;
            this.requests.set(requestId, request);
        }
    }

    plan() {
        let logisticsAnalyst = global.boardroom.managers.get('LogisticsAnalyst') as LogisticsAnalyst;
        let salesAnalyst = global.boardroom.managers.get('SalesAnalyst') as SalesAnalyst;
        let hrAnalyst = global.boardroom.managers.get('HRAnalyst') as HRAnalyst;
        let statisticsAnalyst = global.boardroom.managers.get('StatisticsAnalyst') as StatisticsAnalyst;

        this.storage = logisticsAnalyst.getStorage(this.office)[0];
        this.extensions = hrAnalyst.getExtensions(this.office)
        this.carriers = logisticsAnalyst.getCarriers(this.office)
        this.spawns = hrAnalyst.getSpawns(this.office)

        // Update LogisticsSources
        salesAnalyst.getFranchiseLocations(this.office).forEach(f => {
            if (!this.sources.has(f.sourcePos)) {
                this.sources.set(f.sourcePos, new LogisticsSource(f.sourcePos))
            }
        });
        if (this.storage && !this.sources.has(this.storage.pos)) {
            this.sources.set(this.storage.pos, new LogisticsSource(this.storage.pos, false))
        }
        // TODO: Clean up sources if storage gets destroyed/franchise is abandoned

        switch (this.status) {
            case OfficeManagerStatus.OFFLINE: {
                // Manager is offline, do nothing
                return;
            }
            case OfficeManagerStatus.MINIMAL: {
                // Maintain one carrier
                if (this.carriers.length === 0) {
                    this.office.submit(new MinionRequest(`${this.office.name}_Logistics`, 6, MinionTypes.CARRIER));
                }
                break;
            }
            default: {
                // Maintain enough carriers to keep
                // franchises drained
                let metrics = statisticsAnalyst.metrics.get(this.office.name);
                let inputAverageMean = metrics?.mineContainerLevels.asPercentMean() || 0;
                if (this.carriers.length === 0) {
                    this.office.submit(new MinionRequest(`${this.office.name}_Logistics`, 6, MinionTypes.CARRIER));
                } else if (Game.time % 50 === 0 && inputAverageMean > 0.1) {
                    console.log(`Franchise surplus of ${(inputAverageMean * 100).toFixed(2)}% detected, spawning carrier`);
                    this.office.submit(new MinionRequest(`${this.office.name}_Logistics`, 6, MinionTypes.CARRIER));
                }
                break;
            }
        }

        // Make sure we have a standing request for storage
        if (this.storage && getFreeCapacity(this.storage) > 0) {
            this.submit(this.storage.id, new ResupplyRequest(this.storage, 1))
        }

        // Try to route requests
        let idleCarriers = this.carriers.filter(c => !this.routes.has(c));
        let requests = [...this.requests.values()].sort((a, b) => (a.priority - b.priority));
        while (requests.length > 0) {
            let carrier = idleCarriers.shift();
            if (!carrier) break;
            let route = new LogisticsRoute(carrier, requests[0], [...this.sources.values()]);
            if (route.commit()) {
                this.routes.set(carrier, route);
            }
        }
    }
    run() {
        // Execute routes
        this.routes.forEach((route, creep) => {
            route.run();
            if (route.completed) this.routes.delete(creep);
        })

        // Display visuals
        if (global.v.logistics.state) {
            this.report();
            this.map();
        }
    }
    report() {
        // Franchise energy level (current and average)
        // Storage level (current)
        // Room energy level (current and average)
        let statisticsAnalyst = global.boardroom.managers.get('StatisticsAnalyst') as StatisticsAnalyst;
        let metrics = statisticsAnalyst.metrics.get(this.office.name);

        let lastMineContainerLevel = metrics?.mineContainerLevels.values[metrics?.mineContainerLevels.values.length - 1] || 0
        let lastRoomEnergyLevel = metrics?.roomEnergyLevels.values[metrics?.roomEnergyLevels.values.length - 1] || 0
        let lastFleetLevel = metrics?.fleetLevels.values[metrics?.fleetLevels.values.length - 1] || 0
        let lastMobileDepotLevel = metrics?.mobileDepotLevels.values[metrics?.mobileDepotLevels.values.length - 1] || 0
        let lastStorageLevel = metrics?.storageLevels.values[metrics?.storageLevels.values.length - 1] || 0
        let lastControllerDepotLevel = metrics?.controllerDepotLevels.values[metrics?.controllerDepotLevels.values.length - 1] || 0

        let chart = new Meters([
            new Bar('Franchises', {fill: 'yellow', stroke: 'yellow'}, lastMineContainerLevel, metrics?.mineContainerLevels.maxValue),
            new Bar('HR', {fill: 'magenta', stroke: 'magenta'}, lastRoomEnergyLevel, metrics?.roomEnergyLevels.maxValue),
            new Bar('Fleet', {fill: 'purple', stroke: 'purple'}, lastFleetLevel, metrics?.fleetLevels.maxValue),
            new Bar('Depots', {fill: 'brown', stroke: 'brown'}, lastMobileDepotLevel, metrics?.mobileDepotLevels.maxValue),
            new Bar('Storage', {fill: 'green', stroke: 'green'}, lastStorageLevel, metrics?.storageLevels.maxValue),
            new Bar('Legal', {fill: 'blue', stroke: 'blue'}, lastControllerDepotLevel, metrics?.controllerDepotLevels.maxValue),
        ])

        chart.render(new RoomPosition(2, 2, this.office.center.name));
    }
    map() {
        let logisticsAnalyst = global.boardroom.managers.get('LogisticsAnalyst') as LogisticsAnalyst;
        let depots = logisticsAnalyst.depots.get(this.office.name)

        depots?.forEach(c => new RoomVisual(c.pos.roomName).circle(c.pos, {radius: 1.5, stroke: '#f0f', fill: 'transparent'}))
    }
}
