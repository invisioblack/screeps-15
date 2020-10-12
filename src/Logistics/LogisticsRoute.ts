import { MapAnalyst } from "Boardroom/BoardroomManagers/MapAnalyst";
import { DepotRequest, LogisticsRequest } from "./LogisticsRequest";
import { LogisticsSource } from "./LogisticsSource";

enum RouteState {
    PENDING = 'PENDING',
    GETTING_ENERGY = 'GETTING_ENERGY',
    FULFILLING = 'FULFILLING',
    CANCELLED = 'CANCELLED',
    COMPLETED = 'COMPLETED'
}

export class LogisticsRoute {
    public length = Infinity;
    public state = RouteState.PENDING;
    source?: LogisticsSource;
    requests: LogisticsRequest[];
    private _creep: Id<Creep>;
    public maxCapacity: number = 0;
    public capacity: number = 0;
    public assignedCapacity = new Map<LogisticsRequest, number>();


    public get creep() {
        return Game.getObjectById(this._creep);
    }

    public get completed() {
        return this.state === RouteState.COMPLETED || this.state === RouteState.CANCELLED;
    }


    constructor(creep: Creep, request: LogisticsRequest, sources: LogisticsSource[]) {
        let mapAnalyst = global.boardroom.managers.get('MapAnalyst') as MapAnalyst;

        this.requests = [request];
        this._creep = creep.id;

        // Get shortest route to source and then request
        let creepCapacity = creep.store.getFreeCapacity(RESOURCE_ENERGY);
        // Prefer sources that can fill the creep
        let prioritySources = sources.filter(s => s.capacity > creepCapacity);
        // Failing that, prefer sources that can fill the request
        if (prioritySources.length === 0)
            prioritySources = sources.filter(s => s.capacity > request.capacity);
        // Otherwise, take any available source
        if (prioritySources.length === 0)
            prioritySources = sources;

        // Find shortest path from creep -> source -> request
        prioritySources.forEach(source => {
            let distance = mapAnalyst.getRangeTo(creep.pos, source.pos) + mapAnalyst.getRangeTo(source.pos, request.pos);
            if (distance < this.length) {
                this.source = source;
                this.length = distance;
            }
        })

        if (this.source) {
            this.maxCapacity = Math.min(creep.store.getCapacity(), creep.store.getUsedCapacity() + this.source.capacity);
            this.assignedCapacity.set(request, Math.min(this.maxCapacity, request.capacity));
            if (request instanceof DepotRequest) {
                this.capacity = 0;
            } else {
                this.capacity = this.maxCapacity - request.capacity;
            }
        }
    }

    extend(request: LogisticsRequest) {
        if (this.capacity > 0) {
            this.requests.push(request);
            if (request instanceof DepotRequest) {
                // Don't try to assign other requests after a DepotRequest
                this.capacity = 0;
                return true;
            }
            this.assignedCapacity.set(request, Math.min(this.capacity, request.capacity));
            this.capacity -= request.capacity;
            return true;
        }
        return false;
    }

    commit() {
        if (!this.source) return false;
        if (!this.creep) return false;
        if (!this.requests || this.requests.length === 0) return false;

        // Reserve capacity at the source
        this.source.reserve(this.maxCapacity);
        // Assign requests
        this.requests.forEach(r => {
            r.assigned = true;
            r.assignedCapacity += this.assignedCapacity.get(r) ?? 0
        });
        this.state = RouteState.GETTING_ENERGY;
        return true;
    }

    run() {
        // Validate current state
        if (!this.creep) { // Creep not found
            // Unassign remaining requests
            this.requests.forEach(r => {
                r.assigned = false;
                r.assignedCapacity -= this.assignedCapacity.get(r) ?? 0
            });
            // If creep has not withdrawn, cancel reservation
            if (this.state === RouteState.GETTING_ENERGY) {
                this.source?.unreserve(this.requests.reduce((sum, req) => sum + req.capacity, 0))
            }
            this.state = RouteState.CANCELLED;
            return;
        }
        // Change state, if appropriate
        switch(this.state) {
            case RouteState.GETTING_ENERGY: {
                if (!(this.creep.store.getFreeCapacity() === 0 || this.source?.capacity === 0)) {
                    break;
                }
                this.state = RouteState.FULFILLING;
                // This step done - falls through to the next
            }
            case RouteState.FULFILLING: {
                // Discard any completed requests
                while (this.requests.length > 0 && this.requests[0].completed) {
                    this.requests.shift();
                }
                // If the queue is empty, we're done
                if (this.requests.length === 0) {
                    this.state = RouteState.COMPLETED;
                }
            }
        }
        // Execute state
        switch(this.state) {
            case RouteState.PENDING: // falls through
            case RouteState.COMPLETED: // falls through
            case RouteState.CANCELLED: {
                return;
            }
            case RouteState.GETTING_ENERGY: {
                if (!this.source) {
                    this.state = RouteState.CANCELLED;
                    return;
                }
                let result = this.source.transfer(this.creep);
                if (result !== OK) {
                    this.state = RouteState.CANCELLED;
                }
                break;
            }
            case RouteState.FULFILLING: {
                let result = this.requests[0].action(this.creep);
                if (result !== OK) {
                    this.state = RouteState.CANCELLED;
                }
                break;
            }
        }
    }
}