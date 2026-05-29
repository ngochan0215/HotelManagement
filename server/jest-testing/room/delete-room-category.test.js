// RTM: Delete room category (TC075-DeleteRoomCat-01 .. TC079-DeleteRoomCat-05)
import { RoomService } from "../../main-services/room-service/services/roomService.js";
import { makeFullModel, makeDoc, makeEventBus } from "../helpers/mocks.js";

let RoomCategory, DefaultEquipment, Room, RoomLog, svc;

beforeEach(() => {
  RoomCategory = makeFullModel();
  DefaultEquipment = makeFullModel();
  Room = makeFullModel();
  RoomLog = makeFullModel();
  svc = new RoomService({ Room, RoomCategory, RoomLog, DefaultEquipment, eventBus: makeEventBus() });
});

// TC075-DeleteRoomCat-01 — category must exist
test("TC075-DeleteRoomCat-01: rejects when the category is not found", async () => {
  RoomCategory.findById.mockResolvedValue(null);
  await expect(svc.deleteRoomCategoryService("cat1", false)).rejects.toThrow(
    "Không tìm thấy loại phòng"
  );
});

// TC076-DeleteRoomCat-02 — confirmation required when the category has rooms
test("TC076-DeleteRoomCat-02: returns a confirmation prompt when the category still has rooms", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: "cat1" }));
  Room.countDocuments.mockResolvedValue(3);

  const result = await svc.deleteRoomCategoryService("cat1", false);
  expect(result).toEqual({ needConfirm: true, roomCount: 3 });
  expect(RoomCategory.findByIdAndDelete).not.toHaveBeenCalled();
});

// TC077-DeleteRoomCat-03 — force delete removes all related rooms
test("TC077-DeleteRoomCat-03: force delete removes all rooms of the category", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: "cat1" }));
  Room.countDocuments.mockResolvedValue(3);
  Room.deleteMany.mockResolvedValue({});
  RoomCategory.findByIdAndDelete.mockResolvedValue({});
  DefaultEquipment.deleteMany.mockResolvedValue({});

  await svc.deleteRoomCategoryService("cat1", true);
  expect(Room.deleteMany).toHaveBeenCalledWith({ category_id: "cat1" });
});

// TC078-DeleteRoomCat-04 — category + its default equipment deleted
test("TC078-DeleteRoomCat-04: deletes the category and its default equipment", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: "cat1" }));
  Room.countDocuments.mockResolvedValue(0);
  RoomCategory.findByIdAndDelete.mockResolvedValue({});
  DefaultEquipment.deleteMany.mockResolvedValue({});

  await svc.deleteRoomCategoryService("cat1", false);
  expect(RoomCategory.findByIdAndDelete).toHaveBeenCalledWith("cat1");
  expect(DefaultEquipment.deleteMany).toHaveBeenCalledWith({ category_id: "cat1" });
});

// TC079-DeleteRoomCat-05 — success result
test("TC079-DeleteRoomCat-05: returns success after deletion", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: "cat1" }));
  Room.countDocuments.mockResolvedValue(0);
  RoomCategory.findByIdAndDelete.mockResolvedValue({});
  DefaultEquipment.deleteMany.mockResolvedValue({});

  await expect(svc.deleteRoomCategoryService("cat1", false)).resolves.toEqual({ success: true });
});
