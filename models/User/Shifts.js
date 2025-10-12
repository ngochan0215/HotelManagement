import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema({
  work_day: {
    type: String,
    enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
    required: true,
  },
  shift_type: {
    type: String,
    enum: ['morning','afternoon','evening','midnight'],
    required: true,
  },
  begin_time: { type: String, required: true },
  end_time: { type: String, required: true },
});

const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const shifts = [
  { shift_type: 'morning', begin_time: '07:00', end_time: '12:00' },
  { shift_type: 'afternoon', begin_time: '12:00', end_time: '17:00' },
  { shift_type: 'evening', begin_time: '17:00', end_time: '22:00' },
  { shift_type: 'midnight', begin_time: '22:00', end_time: '03:00' },
];

for (const day of days) {
  for (const shift of shifts) {
    await Shift.create({ work_day: day, ...shift });
  }
}
console.log("Inserted default 28 shifts!");

const Shift = mongoose.models.Shift || mongoose.model("Shift", shiftSchema);
export default Shift;
