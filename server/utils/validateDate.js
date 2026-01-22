
export const validateDate = ({ begin_date, end_date }) => {
    const errors = [];

    const begin = new Date(begin_date);
    const end = new Date(end_date);
    const now = new Date();

    if (isNaN(begin.getTime()) || isNaN(end.getTime())) {
        errors.push("Định dạng ngày không hợp lệ!");
    } else {
        if (begin >= end) errors.push("Ngày bắt đầu phải trước ngày kết thúc!");

        if (end < now) errors.push("Ngày kết thúc không thể nằm trong quá khứ!");
    }

    // return message and invalid flag
    if (errors.length > 0) {
        return { valid: false, message: errors.join(" ") };
    }

    return { valid: true, begin, end };
};