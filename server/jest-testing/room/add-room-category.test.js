// RTM: Add room category (TC062-AddRoomCat-01 .. TC068-AddRoomCat-07)
import { RoomService } from "../../main-services/room-service/services/roomService.js";
import { makeFullModel, makeDoc, makeEventBus } from "../helpers/mocks.js";

const validData = (over = {}) => ({
  category_name: "Deluxe",
  description: "Sea view",
  max_adults: 2,
  max_children: 1,
  price: 1500000,
  default_equipments: [{ equipment_category_id: "eq1", quantity: 2 }],
  ...over,
});

let RoomCategory, DefaultEquipment, Room, RoomLog, svc;

beforeEach(() => {
  RoomCategory = makeFullModel();
  DefaultEquipment = makeFullModel();
  Room = makeFullModel();
  RoomLog = makeFullModel();
  svc = new RoomService({ Room, RoomCategory, RoomLog, DefaultEquipment, eventBus: makeEventBus() });
});

// TC062-AddRoomCat-01 — required fields
test("TC062-AddRoomCat-01: rejects when a required field is missing", async () => {
  await expect(svc.createRoomCategoryService(validData({ price: undefined }), [])).rejects.toThrow(
    "Vui lòng nhập đầy đủ thông tin bắt buộc"
  );
});

// TC063-AddRoomCat-02 — unique name
test("TC063-AddRoomCat-02: rejects a duplicate category name", async () => {
  RoomCategory.findOne.mockResolvedValue(makeDoc({ category_name: "Deluxe" }));
  await expect(svc.createRoomCategoryService(validData(), [])).rejects.toThrow(
    "Tên loại phòng đã tồn tại"
  );
});

// TC064-AddRoomCat-03 — at least one default equipment
test("TC064-AddRoomCat-03: rejects an empty default equipment list", async () => {
  RoomCategory.findOne.mockResolvedValue(null);
  await expect(svc.createRoomCategoryService(validData({ default_equipments: [] }), [])).rejects.toThrow(
    "Vui lòng chọn ít nhất một thiết bị mặc định"
  );
});

// TC065-AddRoomCat-04 — uploaded images stored on the category
test("TC065-AddRoomCat-04: stores uploaded image file paths on the category", async () => {
  RoomCategory.findOne.mockResolvedValue(null);
  RoomCategory.create.mockResolvedValue(makeDoc({ _id: "cat1" }));
  DefaultEquipment.insertMany.mockResolvedValue([]);

  await svc.createRoomCategoryService(validData(), [{ path: "img1.jpg" }, { path: "img2.jpg" }]);

  expect(RoomCategory.create).toHaveBeenCalledWith(
    expect.objectContaining({ images: ["img1.jpg", "img2.jpg"] })
  );
});

// TC066-AddRoomCat-05 — category created with provided attributes
test("TC066-AddRoomCat-05: creates the category with the provided attributes", async () => {
  RoomCategory.findOne.mockResolvedValue(null);
  RoomCategory.create.mockResolvedValue(makeDoc({ _id: "cat1" }));
  DefaultEquipment.insertMany.mockResolvedValue([]);

  await svc.createRoomCategoryService(validData(), []);

  expect(RoomCategory.create).toHaveBeenCalledWith(
    expect.objectContaining({ category_name: "Deluxe", price: 1500000, max_adults: 2 })
  );
});

// TC067-AddRoomCat-06 — default equipment rows inserted
test("TC067-AddRoomCat-06: inserts default equipment rows for the category", async () => {
  RoomCategory.findOne.mockResolvedValue(null);
  RoomCategory.create.mockResolvedValue(makeDoc({ _id: "cat1" }));
  DefaultEquipment.insertMany.mockResolvedValue([]);

  await svc.createRoomCategoryService(validData(), []);

  expect(DefaultEquipment.insertMany).toHaveBeenCalledWith([
    expect.objectContaining({ category_id: "cat1", equipment_category_id: "eq1", quantity: 2 }),
  ]);
});

// TC068-AddRoomCat-07 — returns the created category
test("TC068-AddRoomCat-07: returns the created room category", async () => {
  RoomCategory.findOne.mockResolvedValue(null);
  const cat = makeDoc({ _id: "cat1", category_name: "Deluxe" });
  RoomCategory.create.mockResolvedValue(cat);
  DefaultEquipment.insertMany.mockResolvedValue([]);

  const result = await svc.createRoomCategoryService(validData(), []);
  expect(result.roomCategory).toBe(cat);
});
