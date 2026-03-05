import mongoose from "mongoose";
import { User, Employee, Customer } from "../models/index.js";

export const resolveUserFullName = async (user_id) => {
  if (!user_id) return null;
  const user = await User.findById(user_id).select("system_role");

  if (!user) 
    throw new Error("Không tìm thấy người dùng.");
  
  if (user.system_role === "employee") 
    return await Employee.findOne({ user_id }).select("full_name");
  
  if (user.system_role === "customer") 
    return await Customer.findOne({ user_id }).select("full_name");

  return null;
};