// RTM: Update room (TC086-UpdateRoom-01 .. TC093-UpdateRoom-08)
import { RoomService } from "../../main-services/room-service/services/roomService.js";
import { makeFullModel, makeDoc, makeEventBus, makeQuery, oid } from "../helpers/mocks.js";

let Room, RoomCategory, DefaultEquipment, RoomLog, eventBus, svc;
const ROOM = oid("r1");
const CAT = oid("cat1");

beforeEach(() => {
  Room = makeFullModel();
  RoomCategory = makeFullModel();
  DefaultEquipment = makeFullModel();
  RoomLog = makeFullModel();
  eventBus = makeEventBus();
  svc = new RoomService({ Room, RoomCategory, RoomLog, DefaultEquipment, eventBus });
  // Default: acting user resolves to an employee.
  eventBus.safeRequest.mockResolvedValue({ success: true, employee: { _id: "emp1" } });
});

const roomDoc = (over = {}) => makeDoc({ _id: ROOM, room_number: "101", room_status: "available", ...over });

// TC086-UpdateRoom-01 — room id must be valid
test("TC086-UpdateRoom-01: rejects an invalid room id", async () => {
  await expect(svc.updateRoom({}, "bad-id", "user1")).rejects.toThrow("ID phòng không hợp lệ");
});

// TC087-UpdateRoom-02 — acting user must map to an employee
test("TC087-UpdateRoom-02: rejects when the acting user has no employee record", async () => {
  eventBus.safeRequest.mockResolvedValue({ success: false, message: "Không tìm thấy nhân viên" });
  Room.findById.mockReturnValue(makeQuery(roomDoc()));
  await expect(svc.updateRoom({ room_number: "102" }, ROOM, "user1")).rejects.toThrow(
    "Không tìm thấy nhân viên"
  );
});

// TC088-UpdateRoom-03 — room must exist
test("TC088-UpdateRoom-03: rejects when the room is not found", async () => {
  Room.findById.mockReturnValue(makeQuery(null));
  await expect(svc.updateRoom({ room_number: "102" }, ROOM, "user1")).rejects.toThrow(
    "Không tìm thấy phòng"
  );
});

// TC089-UpdateRoom-04 — changed category must be valid
test("TC089-UpdateRoom-04: rejects an invalid new category", async () => {
  Room.findById.mockReturnValue(makeQuery(roomDoc()));
  await expect(svc.updateRoom({ category_id: "bad-id" }, ROOM, "user1")).rejects.toThrow(
    "ID loại phòng không hợp lệ"
  );
});

// TC090-UpdateRoom-05 — room number must stay unique
test("TC090-UpdateRoom-05: rejects a room number that duplicates another room", async () => {
  Room.findById.mockReturnValue(makeQuery(roomDoc()));
  Room.findOne.mockResolvedValue(makeDoc({ _id: "other", room_number: "102" }));
  await expect(svc.updateRoom({ room_number: "102" }, ROOM, "user1")).rejects.toThrow(
    "Số phòng đã tồn tại"
  );
});

// TC091-UpdateRoom-06 — status transition rules
describe("TC091-UpdateRoom-06: status transition rules", () => {
  test("rejects a status outside the allowed set", async () => {
    Room.findById.mockReturnValue(makeQuery(roomDoc()));
    await expect(svc.updateRoom({ room_status: "sold" }, ROOM, "user1")).rejects.toThrow(
      "Chỉ được chỉnh"
    );
  });

  test("rejects changing a room that is currently occupied", async () => {
    Room.findById.mockReturnValue(makeQuery(roomDoc()));
    RoomLog.findOne.mockReturnValue(makeQuery({ status: "occupied" }));
    await expect(
      svc.updateRoom({ room_status: "maintenance", start_time: new Date().toISOString() }, ROOM, "user1")
    ).rejects.toThrow("Phòng đang có khách");
  });
});

// TC092-UpdateRoom-07 — non-available status needs a valid time window
test("TC092-UpdateRoom-07: a non-available status requires a start_time", async () => {
  Room.findById.mockReturnValue(makeQuery(roomDoc()));
  RoomLog.findOne.mockReturnValue(makeQuery(null)); // currentStatus falls back to 'available'
  await expect(svc.updateRoom({ room_status: "maintenance" }, ROOM, "user1")).rejects.toThrow(
    "Bắt buộc có thời gian bắt đầu"
  );
});

// TC093-UpdateRoom-08 — status change writes a room log
test("TC093-UpdateRoom-08: logs the status change and saves the room", async () => {
  const room = roomDoc();
  const updated = makeDoc({ _id: ROOM, room_status: "maintenance", roomStatusLog: [{ status: "maintenance" }] });
  Room.findById
    .mockReturnValueOnce(makeQuery(room)) // initial fetch
    .mockReturnValueOnce(makeQuery(updated)); // re-fetch for response
  RoomLog.findOne.mockReturnValue(makeQuery(null));
  RoomLog.updateMany.mockResolvedValue({});
  RoomLog.create.mockResolvedValue([{ _id: "log1" }]);

  const result = await svc.updateRoom(
    { room_status: "maintenance", start_time: new Date().toISOString() },
    ROOM,
    "user1"
  );

  expect(RoomLog.create).toHaveBeenCalled();
  expect(room.save).toHaveBeenCalled();
  expect(result).toBe(updated);
});
