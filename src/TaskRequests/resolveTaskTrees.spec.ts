import { Boardroom } from 'Boardroom/Boardroom';
import { assert } from "chai";
import { Office } from 'Office/Office';
import 'reflect-metadata';
import { mockGlobal, mockInstanceOf } from 'screeps-jest';
import { resolveTaskTrees } from "TaskRequests/resolveTaskTrees";
import { TaskPrerequisite } from "TaskRequests/TaskPrerequisite";
import { TaskAction } from './TaskAction';

class MockTaskPrerequisite extends TaskPrerequisite {
  constructor(
    public metReturn: boolean,
    public toMeetTasks: TaskAction[]|null = null
  ) { super(); }
  met = () => this.metReturn;
  toMeet = () => this.toMeetTasks;
}

describe("resolveTaskTrees", () => {
  beforeEach(() => {
    // runs before each test in this block
    mockGlobal<Game>('Game', {
      creeps: {},
      rooms: {},
      spawns: {},
      time: 12345
    }, true)
    mockGlobal<Memory>('Memory', {
      creeps: {},
    }, true)
    mockGlobal<Boardroom>('boardroom', {
      offices: {
        get: (name: string) => new Office(name)
      }
    })
  });

  it("should run", () => {
    let minion = {
      output: 0,
      capacity: 0,
      capacityUsed: 0,
      pos: mockInstanceOf<RoomPosition>({x: 0, y: 0, roomName: 'world'}),
      creep: mockInstanceOf<Creep>({id: 'creep' as Id<Creep>, memory: {office: 'world'}}),
    }
    let result = resolveTaskTrees(minion, new TaskAction())
    assert.isOk(result);
  });

  it("should return the task if the task has a met prerequisite", () => {
    let minion = {
      output: 0,
      capacity: 0,
      capacityUsed: 0,
      pos: mockInstanceOf<RoomPosition>({x: 0, y: 0, roomName: 'world'}),
      creep: mockInstanceOf<Creep>({id: 'creep' as Id<Creep>, memory: {office: 'world'}}),
    }
    let task = new TaskAction();
    task.getPrereqs = () => ([new MockTaskPrerequisite(true)])
    let result = resolveTaskTrees(minion, new TaskAction())
    expect(result).not.toBeNull();
    if (result === null) throw new Error();
    expect(result.length).toEqual(1);
    expect(result[0].tasks.length).toEqual(1);
  })

  it("should return an empty array if the task has an un-meetable prerequisite", () => {
    let minion = {
      output: 0,
      capacity: 0,
      capacityUsed: 0,
      pos: mockInstanceOf<RoomPosition>({x: 0, y: 0, roomName: 'world'}, true),
      creep: mockInstanceOf<Creep>({id: 'creep' as Id<Creep>}, true),
    }
    let task = new TaskAction();
    task.getPrereqs = () => ([new MockTaskPrerequisite(false)])
    let result = resolveTaskTrees(minion, task)
    expect(result).toEqual([]);
  })

  it("should return the task plus prerequisite if the task has a meetable prerequisite", () => {
    let minion = {
      output: 0,
      capacity: 0,
      capacityUsed: 0,
      pos: mockInstanceOf<RoomPosition>({x: 0, y: 0, roomName: 'world'}),
      creep: mockInstanceOf<Creep>({id: 'creep' as Id<Creep>, memory: {office: 'world'}}),
    }
    let task = new TaskAction();
    let prereqTask = new TaskAction();
    task.getPrereqs = () => ([new MockTaskPrerequisite(false, [prereqTask])])
    let result = resolveTaskTrees(minion, task)
    expect(result).not.toBeNull();
    if (result === null) throw new Error();
    expect(result.length).toEqual(1);
    expect(result[0].tasks.length).toEqual(2);
  })

  it("should calculate nested prerequisites", () => {
    let minion = {
      output: 0,
      capacity: 0,
      capacityUsed: 0,
      pos: mockInstanceOf<RoomPosition>({x: 0, y: 0, roomName: 'world'}),
      creep: mockInstanceOf<Creep>({id: 'creep' as Id<Creep>, memory: {office: 'world'}}),
    }
    let task = new TaskAction();
    let prereqTask = new TaskAction();
    let tertiaryTask = new TaskAction();
    task.getPrereqs = () => ([new MockTaskPrerequisite(false, [prereqTask])])
    prereqTask.getPrereqs = () => ([new MockTaskPrerequisite(false, [tertiaryTask])])
    let result = resolveTaskTrees(minion, task)
    expect(result).not.toBeNull();
    if (result === null) throw new Error();
    expect(result.length).toEqual(1);
    expect(result[0].tasks.length).toEqual(3);
  })

  it("should calculate alternative prerequisites", () => {
    let minion = {
      output: 0,
      capacity: 0,
      capacityUsed: 0,
      pos: mockInstanceOf<RoomPosition>({x: 0, y: 0, roomName: 'world'}),
      creep: mockInstanceOf<Creep>({id: 'creep' as Id<Creep>, memory: {office: 'world'}}),
    }
    let task = new TaskAction();
    task.cost = () => 1;
    let prereqTask = new TaskAction();
    prereqTask.cost = () => 2;
    let tertiaryTask = new TaskAction();
    tertiaryTask.cost = () => 3;
    task.getPrereqs = () => ([new MockTaskPrerequisite(false, [prereqTask, tertiaryTask])])
    let result = resolveTaskTrees(minion, task)
    expect(result).not.toBeNull();
    if (result === null) throw new Error();
    expect(result.length).toEqual(2);
    expect(result[0].tasks.length).toEqual(2);
    expect(result[0].cost).toEqual(3);
    expect(result[1].cost).toEqual(4);
  })
});
