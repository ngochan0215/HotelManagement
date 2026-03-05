import { User, Customer, PointsLog } from "../models/index.js";
import * as customerService from "../services/customerService.js";
import mongoose from "mongoose";

const CCCD_REGEX = /^[0-9]{12}$/;
const PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export const getAllCustomers = async (req, res) => {
    try {
        const { total, customers } = await customerService.getAllCustomers(req.query);

        res.status(200).json({
            success: true,
            total,
            customers
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCustomer = async (req, res) => {
    try {
        const customer = await customerService.updateCustomer(req.params.id, req.body);

        return res.status(200).json({
            success: true,
            message: "Cập nhật thông tin khách hàng thành công.",
            data: customer,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const banCustomer = async (req, res) => {
    try {
        await customerService.banCustomer(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Đã vô hiệu hóa tài khoản khách hàng.",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const unbanCustomer = async (req, res) => {
    try {
        await customerService.unbanCustomer(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Đã mở khóa tài khoản khách hàng.",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};