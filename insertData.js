// import { User, Shift } from "./models/index.js";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import bcrypt from "bcrypt";

// dotenv.config();

// await mongoose.connect(process.env.DB_URI);

// const hashedPassword = await bcrypt.hash("admin@01", 10);
// await User.create({ email: "admin@example.com", password: hashedPassword });
// const hashedPassword2 = await bcrypt.hash("employee@01", 10);
// await User.create({ email: "ngochan2005blislife@gmail.com", password: hashedPassword2});

// const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
// const shifts = [
//   { shift_type: 'morning', begin_time: '07:00', end_time: '12:00' },
//   { shift_type: 'afternoon', begin_time: '12:00', end_time: '17:00' },
//   { shift_type: 'evening', begin_time: '17:00', end_time: '22:00' },
//   { shift_type: 'midnight', begin_time: '22:00', end_time: '03:00' },
// ];

// for (const day of days) {
//   for (const shift of shifts) {
//     await Shift.create({ work_day: day, ...shift });
//   }
// }

// console.log("Data inserted successfully!");

// await mongoose.disconnect();

// {
//     "email": "ngochan2005blislife@gmail.com",
//     "password": "ngochan01"
// }
// {
//     "email": "dp1.1a1.10ngochan@gmail.com",
//     "password": "ngochan02"
// }

// {
//     "category_id": "68ffa3793c858822fdc6e1ef",
//     "name": "Buffet sáng",
//     "description": "Khách hàng được tận hưởng một bữa sáng tuyệt vời tại nhà hàng, được tự do lựa chọn món ăn yêu thích. Hoạt động diễn ra từ khung giờ 7:00 AM - 10:00 AM.",
//     "price": "120000",
//     "unit": "portion"
// }

// {
//     "category_id": "68ffa6a93526147cc68ac4ef",
//     "name": "Dịch vụ giặt ủi",
//     "description": "Cung cấp trọn gói từ A-Z cho khách hàng có nhu cầu giặt đồ. Sau khi công việc hoàn thành, khách hàng sẽ nhận được một bộ quần áo thơm tho, sạch sẽ, được xếp gọn gàng.",
//     "unit": "item",
//     "price": "50000"
// }

//---------//KHUYẾN MÃI//----------//
// {
//   "name": "New Year Sale 2026",
//   "description": "Mừng năm mới 2026 - giảm giá 20% toàn bộ phòng nghỉ.",
//   "begin_date": "2025-12-30T00:00:00.000Z",
//   "end_date": "2026-01-05T23:59:59.000Z",
//   "percentage": 20
// }
// {
//   "name": "Summer Sale",
//   "description": "Giảm giá mùa hè nóng bỏng!",
//   "begin_date": "2025-08-01T00:00:00.000Z",
//   "end_date": "2025-07-01T00:00:00.000Z",
//   "percentage": 25
// }
