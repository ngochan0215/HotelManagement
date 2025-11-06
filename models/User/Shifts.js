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

const Shift = mongoose.models.Shift || mongoose.model("Shift", shiftSchema);
export default Shift;
