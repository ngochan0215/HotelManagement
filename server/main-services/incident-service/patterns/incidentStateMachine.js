export const INCIDENT_STATUS = Object.freeze({
    NEW: "new",
    IN_PROGRESS: "in_progress",
    RESOLVED: "resolved",
    CLOSED: "closed",
});

const TARGET_STATUS_BY_ACTION = Object.freeze({
    assign: INCIDENT_STATUS.IN_PROGRESS,
    resolve: INCIDENT_STATUS.RESOLVED,
    close: INCIDENT_STATUS.CLOSED,
});

export class IncidentStateMachine {
    static getTargetStatus(action) {
        const targetStatus = TARGET_STATUS_BY_ACTION[action];
        if (!targetStatus) {
            throw new Error("Hành động chuyển trạng thái sự cố không hợp lệ.");
        }
        return targetStatus;
    }

    static assertCanUpdate(currentStatus) {
        if (currentStatus === INCIDENT_STATUS.CLOSED) {
            throw new Error("Không thể cập nhật sự cố đã đóng.");
        }
    }

    static assertCanAssign(currentStatus) {
        if ([INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.CLOSED].includes(currentStatus)) {
            throw new Error("Không thể phân công sự cố đã xử lý xong");
        }
    }

    static assertCanResolve(currentStatus) {
        if (currentStatus !== INCIDENT_STATUS.IN_PROGRESS) {
            throw new Error("Sự cố chưa được phân công hoặc đã đóng.");
        }
    }

    static assertCanClose(currentStatus) {
        if (currentStatus !== INCIDENT_STATUS.RESOLVED) {
            throw new Error("Chỉ đóng được sự cố đã Resolved.");
        }
    }
}