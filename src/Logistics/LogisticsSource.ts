import { LogisticsAnalyst, RealLogisticsSources } from "Boardroom/BoardroomManagers/LogisticsAnalyst";

import { CachedCreep } from "WorldState/branches/WorldMyCreeps";
import { CachedResource } from "WorldState/branches/WorldResources";
import { Memoize } from "typescript-memoize";
import { getUsedCapacity } from "utils/gameObjectSelectors";
import profiler from "screeps-profiler";
import { travel } from "Logistics/Travel";

/**
 * A cached representation of a Source
 * May be a Franchise, Container, Storage,
 * or just a loose pile of Energy
 */
export class LogisticsSource {
    // Dependencies
    private logisticsAnalyst: LogisticsAnalyst;
    /**
     *
     * @param pos Center of the source (adjacent squares will also be included)
     * @param primary Only primary Sources can fulfill Resupply requests for non-primary Sources
     */
    constructor(
        public pos: RoomPosition,
        public primary = true
    ) {
        this.logisticsAnalyst = global.boardroom.managers.get('LogisticsAnalyst') as LogisticsAnalyst;
    }

    private _sources: RealLogisticsSources[] = [];

    public reservedCapacity = 0;

    @Memoize(() => (`${Game.time}`))
    public get capacity() : number {
        return this.sources.reduce((sum, source) => sum + getUsedCapacity(source), 0) - this.reservedCapacity;
    }

    /**
     * Gets list of surrounding "real" sources,
     * ordered by quantity
     */
    public get sources() : RealLogisticsSources[] {
        if (!Game.rooms[this.pos.roomName]) return this._sources; // No visibility, use cached
        this._sources = this.logisticsAnalyst.getRealLogisticsSources(this.pos);
        return this._sources;
    }

    /**
     * Withdraws resources, or moves to the resources, if not
     * adjacent. May return OK while LogisticsSource still has
     * capacity: check creep & source capacity before finishing
     *
     * @param creep Creep to transfer resources into
     */
    transfer(creep: CachedCreep) {
        let source = this.sources[0];
        if (!source) return ERR_NOT_FOUND;
        if (source.pos.roomName !== creep.pos.roomName) {
            return travel(creep, source.pos);
        }
        if (getUsedCapacity(source) === 0) return ERR_NOT_ENOUGH_ENERGY;

        let result;
        if (source instanceof CachedResource) {
            result = source.gameObj ? creep.gameObj.pickup(source.gameObj) : ERR_NOT_FOUND;
        } else {
            result = source.gameObj ? creep.gameObj.withdraw(source.gameObj, RESOURCE_ENERGY) : ERR_NOT_FOUND;
        }

        if (result === ERR_NOT_IN_RANGE) {
            return travel(creep, source.pos);
        }
        return result;
    }

    reserve(amount: number) {
        this.reservedCapacity += amount;
    }
    unreserve(amount: number) {
        this.reservedCapacity -= amount;
    }
}

profiler.registerClass(LogisticsSource, 'LogisticsSource');
