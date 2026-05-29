// RTM: Update room category (TC069-UpdateRoomCat-01 .. TC074-UpdateRoomCat-06)
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

// TC069-UpdateRoomCat-01 — category must exist
test("TC069-UpdateRoomCat-01: rejects when the category is not found", async () => {
  RoomCategory.findById.mockResolvedValue(null);
  await expect(svc.updateRoomCategoryService("cat1", { category_name: "X" }, [])).rejects.toThrow(
    "Không tìm thấy loại phòng"
  );
});

// TC070-UpdateRoomCat-02 — unique name (excluding itself)
test("TC070-UpdateRoomCat-02: rejects a name that duplicates another category", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: "cat1", category_name: "Old" }));
  RoomCategory.findOne.mockResolvedValue(makeDoc({ _id: "cat2", category_name: "Deluxe" }));
  await expect(svc.updateRoomCategoryService("cat1", { category_name: "Deluxe" }, [])).rejects.toThrow(
    "Tên loại phòng đã tồn tại"
  );
});

// TC071-UpdateRoomCat-03 — provided fields updated, others retained
test("TC071-UpdateRoomCat-03: updates provided fields and keeps the rest", async () => {
  const cat = makeDoc({ _id: "cat1", category_name: "Old", description: "keep", price: 1000 });
  RoomCategory.findById.mockResolvedValue(cat);
  RoomCategory.findOne.mockResolvedValue(null);

  const result = await svc.updateRoomCategoryService("cat1", { category_name: "New", price: 2000 }, []);

  expect(cat.save).toHaveBeenCalled();
  expect(result.category_name).toBe("New");
  expect(result.price).toBe(2000);
  expect(result.description).toBe("keep");
});

// TC072-UpdateRoomCat-04 — default equipment list replaced when provided
test("TC072-UpdateRoomCat-04: replaces the default equipment list when supplied", async () => {
  RoomCategory.findById.mockResolvedValue(makeDoc({ _id: "cat1" }));
  RoomCategory.findOne.mockResolvedValue(null);
  DefaultEquipment.deleteMany.mockResolvedValue({});
  DefaultEquipment.insertMany.mockResolvedValue([]);

  await svc.updateRoomCategoryService(
    "cat1",
    { default_equipments: [{ equipment_category_id: "eq9", quantity: 3 }] },
    []
  );

  expect(DefaultEquipment.deleteMany).toHaveBeenCalledWith({ category_id: "cat1" });
  expect(DefaultEquipment.insertMany).toHaveBeenCalledWith([
    expect.objectContaining({ category_id: "cat1", equipment_category_id: "eq9", quantity: 3 }),
  ]);
});

// TC073-UpdateRoomCat-05 — images replaced when new files uploaded
test("TC073-UpdateRoomCat-05: replaces images when new files are uploaded", async () => {
  const cat = makeDoc({ _id: "cat1", images: ["old.jpg"] });
  RoomCategory.findById.mockResolvedValue(cat);
  RoomCategory.findOne.mockResolvedValue(null);

  const result = await svc.updateRoomCategoryService("cat1", {}, [{ path: "new.jpg" }]);
  expect(result.images).toEqual(["new.jpg"]);
});

// TC074-UpdateRoomCat-06 — returns the updated category
test("TC074-UpdateRoomCat-06: returns the updated category", async () => {
  const cat = makeDoc({ _id: "cat1", category_name: "Old" });
  RoomCategory.findById.mockResolvedValue(cat);
  RoomCategory.findOne.mockResolvedValue(null);

  const result = await svc.updateRoomCategoryService("cat1", { description: "updated" }, []);
  expect(result).toBe(cat);
});
