import { DefenseAnalyst, TerritoryIntent } from "./DefenseAnalyst";

import { Boardroom } from "Boardroom/Boardroom";
import { BoardroomManager } from "Boardroom/BoardroomManager";
import { CachedSource } from "WorldState/branches/WorldSources";
import { HRAnalyst } from "./HRAnalyst";
import { MapAnalyst } from "./MapAnalyst";
import { Memoize } from "typescript-memoize";
import { Office } from "Office/Office";
import { SalesManager } from "Office/OfficeManagers/SalesManager";
import { SalesmanMinion } from "MinionDefinitions/SalesmanMinion";
import { lazyFilter } from "utils/lazyIterators";

export class SalesAnalyst extends BoardroomManager {
    constructor(
        boardroom: Boardroom,
        public mapAnalyst = boardroom.managers.get('MapAnalyst') as MapAnalyst
    ) {
        super(boardroom);
    }

    plan() {
        this.boardroom.offices.forEach(office => {
            // If necessary, add franchise locations for territory
            for (let t of global.worldState.rooms.byOffice.get(office.name) ?? []) {
                for (let s of global.worldState.sources.byRoom.get(t.name) ?? []) {
                    // Initialize properties
                    if (s.maxSalesmen === 0) {
                        for (let pos of this.mapAnalyst?.calculateAdjacentPositions(s.pos)) {
                            if (this.mapAnalyst.isPositionWalkable(pos, true)) s.maxSalesmen += 1;
                        }
                    }
                    if (!s.officeId) {
                        s.officeId = office.name;
                    }
                    if (!s.franchisePos || !s.linkPos) {
                        let {container, link} = this.calculateBestMiningLocation(office, s.pos);
                        s.franchisePos = container;
                        s.linkPos = link;
                    }
                }
            }
        })
    }

    @Memoize((office: Office, sourcePos: RoomPosition) => ('' + office.name + sourcePos.toString() + Game.time))
    calculateBestMiningLocation(office: Office, sourcePos: RoomPosition) {
        let hrAnalyst = this.boardroom.managers.get('HRAnalyst') as HRAnalyst;
        let spawn = hrAnalyst.getSpawns(office)[0];
        let route = PathFinder.search(sourcePos, spawn.pos);
        if (route.incomplete) throw new Error('Unable to calculate mining location');
        let containerPos = route.path[0];
        // Candidate position: adjacent to franchisePos,
        let linkCandidates = this.mapAnalyst.calculateAdjacentPositions(containerPos).filter(pos => (
            this.mapAnalyst.isPositionWalkable(pos) &&
            !pos.isEqualTo(route.path[1])
        ))
        return {
            link: linkCandidates[0],
            container: containerPos
        }
    }
    @Memoize((office: Office) => ('' + office.name + Game.time))
    getUsableSourceLocations(office: Office) {
        let defenseAnalyst = this.boardroom.managers.get('DefenseAnalyst') as DefenseAnalyst;
        let usableSources: CachedSource[] = [];
        for (let room of global.worldState.rooms.byOffice.get(office.name) ?? []) {
            if (defenseAnalyst.getTerritoryIntent(room.name) === TerritoryIntent.EXPLOIT) {
                usableSources.push(...(global.worldState.sources.byRoom.get(room.name) ?? []))
            }
        }
        return usableSources;
    }
    @Memoize((office: Office) => ('' + office.name + Game.time))
    getSources (office: Office) {
        let usableSources: CachedSource[] = [];
        for (let room of global.worldState.rooms.byOffice.get(office.name) ?? []) {
            usableSources.push(...(global.worldState.sources.byRoom.get(room.name) ?? []));
        }
        return usableSources;
    }
    @Memoize((office: Office) => ('' + office.name + Game.time))
    getUntappedSources(office: Office) {
        return this.getUsableSourceLocations(office).filter(source => !this.isSourceTapped(source))
    }
    @Memoize((office: Office) => ('' + office.name + Game.time))
    unassignedHarvestRequests(office: Office) {
        return (office.managers.get('SalesManager') as SalesManager).requests.filter(r => !r.capacityMet());
    }
    @Memoize((source) => ('' + source.toString() + Game.time))
    isSourceTapped(source: CachedSource) {
        let count = 0;
        let workParts = 0;
        for (let salesman of lazyFilter(
            global.worldState.myCreeps.byOffice.get(source.officeId as string) ?? [],
            c => c.memory?.source === source.id
        )) {
            count += 1;
            workParts += salesman.gameObj.getActiveBodyparts(WORK);
            if (workParts >= 5 || (source.maxSalesmen && count >= source.maxSalesmen)) {
                return true;
            }
        }
        return false;
    }
    @Memoize((office: Office) => ('' + office.name + Game.time))
    getMaxEffectiveInput(office: Office) {
        let minionWorkParts = new SalesmanMinion().scaleMinion(office.center.gameObj.energyCapacityAvailable)
                                               .filter(p => p === WORK).length;

        // Max energy output per tick
        return 2 * this.getUsableSourceLocations(office).reduce((sum, source) => (
            sum + Math.max(5, minionWorkParts * source.maxSalesmen)
        ), 0)
    }
    @Memoize((office: Office) => ('' + office.name + Game.time))
    getFranchiseSurplus(office: Office) {
        // Sum of surpluses across franchises
        let franchises = this.getUsableSourceLocations(office)
        let surplus = franchises.reduce((sum, source) => sum + (source.surplus ?? 0), 0);
        return (surplus / (franchises.length * CONTAINER_CAPACITY))
    }
}
