// RTM: Add room (TC080-AddRoom-01 .. TC085-AddRoom-06)
import { RoomService } from "../../main-services/room-service/services/roomService.js";
import { makeFullModel, makeDoc, makeEventBus, makeQuery, oid } from "../helpers/mocks.js";

// createRoom does `new this.Room(...)`, so Room must be a constructor that also
// carries the static query methods.
const makeRoomModel = () => {
  const ctor = jest.fn(function (data) {
    Object.assign(this, data);
    this._id = "r1";
    this.save = jest.fn().mockResolvedValue(this);
  });
  Object.assign(ctor, makeFullModel());
  return ctor;
};

let Room, RoomCategory, DefaultEquipment, RoomLog, svc;
const CAT = oid("cat1");

beforeEach(() => {
  Room = makeRoomModel();
  RoomCategory = makeFullModel();
  DefaultEquipment = makeFullModel();
  RoomLog = makeFullModel();
  svc = new RoomService({ Room, RoomCategory, RoomLog, DefaultEquipment, eventBus: makeEventBus() });
});

// TC080-AddRoom-01 — required fields
test("TC080-AddRoom-01: rejects when category_id or room_number is missing", async () => {
  await expect(svc.createRoom({ room_number: "101" })).rejects.toThrow(
    "Vui lòng nhập đầy đủ thông tin bắt buộc"
  );
});

// TC081-AddRoom-02 — category id must be a valid ObjectId
test("TC081-AddRoom-02: rejects an invalid category id", async () => {
  await expect(svc.createRoom({ category_id: "bad-id", room_number: "101" })).rejects.toThrow(
    "ID loại phòng không hợp lệ"
  );
});

// TC082-AddRoom-03 — category must exist
test("TC082-AddRoom-03: rejects when the category does not exist", async () => {
  RoomCategory.findById.mockResolvedValue(null);
  await expect(svc.createRoom({ category_id: CAT, room_number: "101" })).rejects.toThrow(
    "Không tìm thấy loại phòng"
  );
});

// TC083-AddRoom-04 — room number must be unique
test("TC083-AddRoom-04: rejects a duplicate room number", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: CAT }));
  Room.findOne.mockResolvedValue(makeDoc({ room_number: "101" }));
  await expect(svc.createRoom({ category_id: CAT, room_number: "101" })).rejects.toThrow(
    "Số phòng đã tồn tại"
  );
});

// TC084-AddRoom-05 — initial status restricted
test("TC084-AddRoom-05: rejects an invalid initial room status", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: CAT }));
  Room.findOne.mockResolvedValue(null);
  await expect(
    svc.createRoom({ category_id: CAT, room_number: "101", room_status: "occupied" })
  ).rejects.toThrow("Chỉ được chọn trạng thái");
});

// TC085-AddRoom-06 — room created and returned populated
test("TC085-AddRoom-06: creates the room and returns it populated with its category", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: CAT }));
  Room.findOne.mockResolvedValue(null);
  const populated = makeDoc({ _id: "r1", room_number: "101", category_id: { category_name: "Deluxe" } });
  Room.findById.mockReturnValue(makeQuery(populated));

  const result = await svc.createRoom({ category_id: CAT, room_number: "101" });
  expect(Room).toHaveBeenCalledTimes(1); // constructor invoked
  expect(result).toBe(populated);
});
