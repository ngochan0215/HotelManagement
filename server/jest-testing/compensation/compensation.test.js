// RTM: Compensation ticket management (TC138-Compensation-01 .. TC145-Compensation-08)
import { CompensateService } from "../../main-services/incident-service/services/compensationService.js";
import { makeFullModel, makeDoc, makeEventBus, makeQuery, oid } from "../helpers/mocks.js";

let CompensateTicket, CompensateDetail, Incident, IncidentLog, eventBus, svc;
const INC = oid("a1");

beforeEach(() => {
  CompensateTicket = makeFullModel();
  CompensateDetail = makeFullModel();
  Incident = makeFullModel();
  IncidentLog = makeFullModel();
  eventBus = makeEventBus();
  svc = new CompensateService({ CompensateTicket, CompensateDetail, Incident, IncidentLog, eventBus });
  // actor lookup succeeds by default
  eventBus.safeRequest.mockResolvedValue({ success: true, employee: { _id: "emp1", full_name: "Tech", position: "technician" } });
  IncidentLog.create.mockResolvedValue({});
});

const incidentDoc = (over = {}) =>
  makeDoc({ _id: INC, causer_id: oid("c1"), booking_id: oid("bk1"), compensation_status: "none", status: "in_progress", ...over });

// TC138-Compensation-01 — required fields
test("TC138-Compensation-01: rejects when payer or details are missing", async () => {
  await expect(svc.createCompensateTicket("u1", INC, { payer_type: "customer" })).rejects.toThrow(
    "Yêu cầu nhập đầy đủ thông tin"
  );
});

// TC139-Compensation-02 — incident must exist
test("TC139-Compensation-02: rejects when the incident does not exist", async () => {
  Incident.findById.mockResolvedValue(null);
  await expect(
    svc.createCompensateTicket("u1", INC, { payer_type: "customer", compensation_details: [{}] })
  ).rejects.toThrow("Sự cố không tồn tại");
});

// TC140-Compensation-03 — only one ticket per incident
test("TC140-Compensation-03: rejects when the incident already has a ticket", async () => {
  Incident.findById.mockResolvedValue(incidentDoc({ compensation_status: "pending" }));
  await expect(
    svc.createCompensateTicket("u1", INC, { payer_type: "customer", compensation_details: [{}] })
  ).rejects.toThrow("Sự cố đã có phiếu đền bù");
});

// TC141-Compensation-04 — payer type validated
test("TC141-Compensation-04: rejects an invalid payer type", async () => {
  Incident.findById.mockResolvedValue(incidentDoc());
  CompensateTicket.findOne.mockResolvedValue(null);
  await expect(
    svc.createCompensateTicket("u1", INC, { payer_type: "alien", payer_id: oid("c1"), compensation_details: [{}] })
  ).rejects.toThrow("payer_type không hợp lệ");
});

// TC142-Compensation-05 — total fee built from the detail lines
test("TC142-Compensation-05: totals the fee from the compensation details", async () => {
  const incident = incidentDoc();
  Incident.findById.mockResolvedValue(incident);
  CompensateTicket.findOne.mockResolvedValue(null);
  jest.spyOn(svc, "buildCompensationDetails").mockResolvedValue({
    details: [{ equipment_id: "eq1", resolution: "repair", broken_state: "cracked", penalty_fee: 500 }],
    totalFee: 500,
  });
  jest.spyOn(svc, "updateEquipmentByResolution").mockResolvedValue({});
  CompensateTicket.create.mockResolvedValue(makeDoc({ _id: "t1", total_fee: 500 }));
  CompensateDetail.insertMany.mockResolvedValue([]);

  await svc.createCompensateTicket("u1", INC, {
    payer_type: "customer", payer_id: oid("c1"), compensation_details: [{ equipment_id: "eq1" }],
  });

  expect(CompensateTicket.create).toHaveBeenCalledWith(
    expect.objectContaining({ total_fee: 500, status: "pending" })
  );
});

// TC143-Compensation-06 — ticket created and incident linked
test("TC143-Compensation-06: creates the ticket and marks the incident compensation pending", async () => {
  const incident = incidentDoc();
  Incident.findById.mockResolvedValue(incident);
  CompensateTicket.findOne.mockResolvedValue(null);
  jest.spyOn(svc, "buildCompensationDetails").mockResolvedValue({ details: [], totalFee: 0 });
  jest.spyOn(svc, "updateEquipmentByResolution").mockResolvedValue({});
  const ticket = makeDoc({ _id: "t1", status: "pending" });
  CompensateTicket.create.mockResolvedValue(ticket);
  CompensateDetail.insertMany.mockResolvedValue([]);

  const result = await svc.createCompensateTicket("u1", INC, {
    payer_type: "hotel", compensation_details: [],
  });

  expect(result).toBe(ticket);
  expect(incident.compensation_status).toBe("pending");
});

// TC144-Compensation-07 — update a pending ticket
describe("TC144-Compensation-07: update a compensation ticket", () => {
  test("applies allowed updates", async () => {
    const ticket = makeDoc({ _id: "t1", status: "pending", incident_id: null });
    CompensateTicket.findById.mockResolvedValue(ticket);
    const result = await svc.updateCompensateTicket("t1", { note: "updated note" });
    expect(result.note).toBe("updated note");
    expect(ticket.save).toHaveBeenCalled();
  });

  test("rejects forbidden field updates", async () => {
    CompensateTicket.findById.mockResolvedValue(makeDoc({ _id: "t1", status: "pending", incident_id: null }));
    await expect(svc.updateCompensateTicket("t1", { status: "paid" })).rejects.toThrow(
      "Không được phép cập nhật trường status"
    );
  });
});

// TC145-Compensation-08 — confirm a ticket as paid, reflected on the incident
test("TC145-Compensation-08: confirms the ticket paid and closes the incident", async () => {
  const ticket = makeDoc({ _id: "t1", status: "pending", incident_id: INC });
  CompensateTicket.findById.mockReturnValue(makeQuery(ticket));
  const incident = incidentDoc({ status: "resolved", compensation_status: "pending" });
  Incident.findById.mockResolvedValue(incident);

  await svc.confirmCompensationPaid("u1", "t1", "paid in cash");

  expect(ticket.status).toBe("paid");
  expect(incident.compensation_status).toBe("done");
  expect(incident.status).toBe("closed");
});
