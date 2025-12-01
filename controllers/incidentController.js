import { Incident, Room, User } from "../models";
import mongoose from "mongoose";

export const reportIncident = async (req, res) => {
    try {
        const { room_id, causer_id, reporter_id, caused_by, description, type, severity, occured_at, fixed_date, finish_date } = req.body;

        if (!room_id || !causer_id || !reporter_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }

        const user = await User.findById(causer_id);
        if (!user) {
            return res.status(404).json({ message: "Người dùng gây ra sự cố không tồn tại." });
        }

        const incident = new Incident({
            room_id,
            causer_id,
            reporter_id,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            fixed_date: fixed_date ? new Date(fixed_date) : null,
            finish_date: finish_date ? new Date(finish_date) : null,
        });

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
    }
};

export const updateIncident = async (req, res) => {
    try {
        const { description, type, severity, fixed_date, finish_date } = req.body;

        if (!room_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }

        const user = await User.findById(caused_user);
        if (!user) {
            return res.status(404).json({ message: "Người dùng gây ra sự cố không tồn tại." });
        }

        const incident = new Incident({
            room_id,
            caused_user,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            fixed_date: fixed_date ? new Date(fixed_date) : null,
            finish_date: finish_date ? new Date(finish_date) : null,
        });

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
    }
};

export const getAllIncidents = async (req, res) => {
    try {
        const { room_id, caused_user, caused_by, description, type, severity, occured_at, fixed_date, finish_date } = req.body;

        if (!room_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }

        const user = await User.findById(caused_user);
        if (!user) {
            return res.status(404).json({ message: "Người dùng gây ra sự cố không tồn tại." });
        }

        const incident = new Incident({
            room_id,
            caused_user,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            fixed_date: fixed_date ? new Date(fixed_date) : null,
            finish_date: finish_date ? new Date(finish_date) : null,
        });

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
    }
};

export const getIncidentById = async (req, res) => {
    try {
        const { room_id, caused_user, caused_by, description, type, severity, occured_at, fixed_date, finish_date } = req.body;

        if (!room_id || !description || !type || !caused_by || !severity || !occured_at) {
            return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
        }

        const room = await Room.findById(room_id);
        if (!room) {
            return res.status(404).json({ message: "Phòng không tồn tại." });
        }

        const user = await User.findById(caused_user);
        if (!user) {
            return res.status(404).json({ message: "Người dùng gây ra sự cố không tồn tại." });
        }

        const incident = new Incident({
            room_id,
            caused_user,
            caused_by,  
            description,
            type,
            severity,
            occured_at: new Date(occured_at),
            fixed_date: fixed_date ? new Date(fixed_date) : null,
            finish_date: finish_date ? new Date(finish_date) : null,
        });

        return res.status(201).json({
            message: "Thêm sự cố thành công.",
            data: incident,
        });
    } catch (err) {
        return res.status(400).json({ message: err.message || "Lỗi khi tạo sự cố."});
    }
};