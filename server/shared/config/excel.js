export const safeForEach = (data, callback) => {
    if (data && Array.isArray(data)) {
        data.forEach(callback);
    }
};

export const parseRange = (from, to) => {
    const start = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = to ? new Date(to) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

export const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay() || 7;
    
    const start = new Date(d);
    start.setDate(d.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
}
    
export const getMonthRange = (date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}
    
export const getRange = (period) => {
    const now = new Date();
    let start, end = new Date(now);

    if (period === "week") {
    const day = now.getDay() || 7;
    start = new Date(now);
    start.setDate(now.getDate() - day + 1);
    } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
    start = new Date(now.getFullYear(), 0, 1);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}