import React from "react";
import { FiCheckCircle, FiXCircle, FiAlertCircle, FiClock, FiInfo } from "react-icons/fi";

const COLORS = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  green:   "bg-green-50 text-green-700 border-green-200",
  blue:    "bg-blue-50 text-blue-700 border-blue-200",
  indigo:  "bg-indigo-50 text-indigo-700 border-indigo-200",
  purple:  "bg-purple-50 text-purple-700 border-purple-200",
  pink:    "bg-pink-50 text-pink-700 border-pink-200",
  red:     "bg-red-50 text-red-700 border-red-200",
  orange:  "bg-orange-50 text-orange-700 border-orange-200",
  yellow:  "bg-yellow-50 text-yellow-700 border-yellow-200",
  gray:    "bg-gray-50 text-gray-700 border-gray-200",
};

const ICONS = {
  success: <FiCheckCircle size={12} />,
  error:   <FiXCircle size={12} />,
  warning: <FiAlertCircle size={12} />,
  wait:    <FiClock size={12} />,
  info:    <FiInfo size={12} />,
};

export const StatusPill = ({ label, color = "gray", iconType }) => {
  const colorClass = COLORS[color] || COLORS.gray;
  const Icon = ICONS[iconType];

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
      {Icon && <span>{Icon}</span>}
      {label}
    </span>
  );
};

export const RankBadge = ({ label, color = "gray", width = "w-32", iconType }) => {
  const colorClass = COLORS[color] || COLORS.gray;
  const Icon = ICONS[iconType];

  return (
    <span className={`inline-flex items-center justify-center gap-1.5 ${width} py-1 text-xs font-bold uppercase rounded border ${colorClass}`}>
      {Icon && <span>{Icon}</span>}
      {label}
    </span>
  );
};