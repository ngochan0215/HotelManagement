// RTM: Incident management (TC121-Incident-01 .. TC129-Incident-09)
import { IncidentService } from "../../main-services/incident-service/services/incidentService.js";
import { makeFullModel, makeDoc, makeEventBus, oid } from "../helpers/mocks.js";

let Incident, IncidentLog, CompensateTicket, eventBus, svc;
const INC = oid("a1");
const EMP = oid("e1");

beforeEach(() => {
  Incident = makeFullModel();
  IncidentLog = makeFullModel();
  CompensateTicket = makeFullModel();
  eventBus = makeEventBus();
  svc = new IncidentService({ Incident, IncidentLog, CompensateTicket, eventBus });
  IncidentLog.create.mockResolvedValue({});
});

const validIncident = (over = {}) => ({
  description: "Broken AC",
  type: "equipment",
  caused_by: "customer",
  severity: "high",
  occured_at: new Date().toISOString(),
  ...over,
});

// TC121-Incident-01 — required fields
test("TC121-Incident-01: rejects when a required field is missing", async () => {
  await expect(svc.createIncident("u1", validIncident({ description: undefined }))).rejects.toThrow(
    "Thiếu thông tin bắt buộc"
  );
});

// TC122-Incident-02 — referenced room must exist
test("TC122-Incident-02: rejects when the referenced room does not exist", async () => {
  eventBus.safeRequest.mockResolvedValue({ success: false, message: "Phòng không tồn tại." });
  await expect(svc.createIncident("u1", validIncident({ room_id: oid("b1") }))).rejects.toThrow(
    "Phòng không tồn tại"
  );
});

// TC123-Incident-03 — affected equipment must be valid
test("TC123-Incident-03: rejects when affected equipment ids are invalid", async () => {
  eventBus.safeRequest.mockResolvedValue({ success: false, message: "Thiết bị bị sự cố không hợp lệ." });
  await expect(svc.createIncident("u1", validIncident({ equipment_ids: ["eq1"] }))).rejects.toThrow(
    "Thiết bị bị sự cố không hợp lệ"
  );
});

// TC124-Incident-04 — must have occurred within 30 days
test("TC124-Incident-04: rejects an incident older than 30 days", async () => {
  const old = new Date();
  old.setDate(old.getDate() - 40);
  await expect(svc.createIncident("u1", validIncident({ occured_at: old.toISOString() }))).rejects.toThrow(
    "Sự cố đã xảy ra quá 30 ngày"
  );
});

// TC125-Incident-05 — created with status "new"
test("TC125-Incident-05: creates the incident with status 'new'", async () => {
  Incident.create.mockResolvedValue(makeDoc({ _id: INC, status: "new" }));
  const result = await svc.createIncident("u1", validIncident());
  expect(Incident.create).toHaveBeenCalledWith(expect.objectContaining({ status: "new" }));
  expect(result.status).toBe("new");
});

// TC126-Incident-06 — assign to a technician
test("TC126-Incident-06: assigns the incident to a technician", async () => {
  Incident.findById.mockResolvedValue(makeDoc({ _id: INC, status: "new" }));
  eventBus.safeRequest
    .mockResolvedValueOnce({ success: true, employee: { _id: EMP, full_name: "Tech", position: "technician" } }) // assignee
    .mockResolvedValueOnce({ success: true, employee: { _id: oid("f1"), full_name: "Mgr", position: "manager" } }); // actor

  const result = await svc.assignIncident("actor1", INC, EMP, "please fix");
  expect(result.status).toBe("in_progress");
  expect(result.assignee_info.assignee_id).toBe(EMP);
});

// TC127-Incident-07 — resolution requires a note
test("TC127-Incident-07: rejects resolving without a handling note", async () => {
  await expect(svc.resolveIncident("u1", INC, {})).rejects.toThrow("Thiếu ghi chú xử lý");
});

// TC128-Incident-08 — cannot close while compensation pending
test("TC128-Incident-08: rejects closing while compensation is unfinished", async () => {
  eventBus.safeRequest.mockResolvedValue({ success: true, employee: { _id: EMP, full_name: "Mgr", position: "manager" } });
  Incident.findById.mockResolvedValue(
    makeDoc({ _id: INC, status: "resolved", caused_by: "equipment", compensation_status: "pending" })
  );
  await expect(svc.closedIncident("u1", INC, { note: "close it" })).rejects.toThrow(
    "Chưa thể đóng sự cố khi quy trình đền bù chưa kết thúc"
  );
});

// TC129-Incident-09 — cannot delete once a compensation ticket exists
test("TC129-Incident-09: rejects deleting an incident that has a compensation ticket", async () => {
  Incident.findById.mockResolvedValue(makeDoc({ _id: INC }));
  CompensateTicket.exists.mockResolvedValue({ _id: "t1" });
  await expect(svc.deleteIncident(INC)).rejects.toThrow(
    "Không thể xóa sự cố vì đã có phiếu đền bù"
  );
});
