import React, { useEffect, useState } from "react";
import { attractionApi } from "../../api/attractionApi.js";

const CATEGORIES = [
    { value: "", label: "Tất cả" },
    { value: "cultural", label: "Văn hóa" },
    { value: "natural", label: "Thiên nhiên" },
    { value: "food", label: "Ẩm thực" },
    { value: "entertainment", label: "Giải trí" },
    { value: "sport", label: "Thể thao" },
    { value: "other", label: "Khác" },
];

function Stars({ rating }) {
    return (
        <span style={{ color: "#f59e0b", fontSize: 14 }}>
            {"★".repeat(rating)}{"☆".repeat(3 - rating)}
        </span>
    );
}

function AttractionDetailModal({ attraction, onClose }) {
    if (!attraction) return null;

    const lat = attraction.coordinates?.lat;
    const lng = attraction.coordinates?.lng;
    const mapEmbedUrl = lat && lng
        ? `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`
        : null;
    const mapsUrl = lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(attraction.name)}`;

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: "#fff", borderRadius: 12, width: 620, maxHeight: "90vh",
                    overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                }}
            >
                {/* Header image */}
                {attraction.image_url ? (
                    <img
                        src={attraction.image_url}
                        alt={attraction.name}
                        style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: "12px 12px 0 0", display: "block" }}
                        onError={e => { e.target.style.display = "none"; }}
                    />
                ) : null}

                <div style={{ padding: "20px 24px 24px" }}>
                    {/* Title row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>{attraction.name}</h2>
                            <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center" }}>
                                <Stars rating={attraction.rating} />
                                <span style={{ fontSize: 12, background: "#e0e7ff", color: "#4338ca", borderRadius: 4, padding: "2px 8px" }}>
                                    {CATEGORIES.find(c => c.value === attraction.category)?.label || attraction.category}
                                </span>
                                <span style={{ fontSize: 12, color: "#6b7280" }}>📍 {attraction.distance_km} km</span>
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7280", marginLeft: 12 }}>✕</button>
                    </div>

                    {/* Description */}
                    <div style={{ marginTop: 14, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                        {attraction.description || <span style={{ color: "#9ca3af" }}>Chưa có mô tả.</span>}
                    </div>

                    {/* Google Maps embed */}
                    {mapEmbedUrl && (
                        <div style={{ marginTop: 18 }}>
                            <iframe
                                title={attraction.name}
                                src={mapEmbedUrl}
                                width="100%"
                                height="240"
                                style={{ border: "none", borderRadius: 8 }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    )}

                    {/* Action links */}
                    <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                        <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                background: "#4f46e5", color: "#fff", borderRadius: 7,
                                padding: "8px 16px", fontSize: 13, textDecoration: "none", fontWeight: 500,
                            }}
                        >
                            🗺️ Mở Google Maps
                        </a>
                        {attraction.wikipedia_url && (
                            <a
                                href={attraction.wikipedia_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 6,
                                    background: "#f3f4f6", color: "#374151", borderRadius: 7,
                                    padding: "8px 16px", fontSize: 13, textDecoration: "none", fontWeight: 500,
                                    border: "1px solid #e5e7eb",
                                }}
                            >
                                📖 Wikipedia
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function AttractionCard({ attraction, onClick }) {
    return (
        <div
            onClick={() => onClick(attraction)}
            style={{
                border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden",
                background: "#fff", cursor: "pointer", transition: "box-shadow 0.2s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.13)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)"}
        >
            {attraction.image_url ? (
                <img
                    src={attraction.image_url}
                    alt={attraction.name}
                    style={{ width: "100%", height: 140, objectFit: "cover" }}
                    onError={e => { e.target.style.display = "none"; }}
                />
            ) : (
                <div style={{
                    height: 80, background: "#f3f4f6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#9ca3af", fontSize: 12,
                }}>
                    Không có ảnh
                </div>
            )}

            <div style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {attraction.name}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Stars rating={attraction.rating} />
                    <span style={{ fontSize: 11, background: "#e0e7ff", color: "#4338ca", borderRadius: 4, padding: "1px 6px" }}>
                        {CATEGORIES.find(c => c.value === attraction.category)?.label || attraction.category}
                    </span>
                </div>

                <div style={{ fontSize: 12, color: "#374151", height: 48, overflow: "hidden", lineHeight: 1.5 }}>
                    {attraction.description || <span style={{ color: "#9ca3af" }}>Chưa có mô tả.</span>}
                </div>

                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                    📍 {attraction.distance_km} km &nbsp;·&nbsp;
                    {attraction.coordinates?.lat?.toFixed(4)}, {attraction.coordinates?.lng?.toFixed(4)}
                </div>
            </div>
        </div>
    );
}

export default function AttractionPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);

    const [category, setCategory] = useState("");
    const [maxDistance, setMaxDistance] = useState("");
    const [page, setPage] = useState(1);
    const LIMIT = 12;

    const fetchAttractions = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { page, limit: LIMIT };
            if (category) params.category = category;
            if (maxDistance) params.max_distance = Number(maxDistance) * 1000; // km → m

            const res = await attractionApi.getAll(params);
            setData(res);
        } catch (err) {
            console.error("[AttractionPage] fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttractions();
    }, [category, maxDistance, page]);

    const totalPages = data ? Math.ceil(data.total / LIMIT) : 0;

    return (
        <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "sans-serif" }}>
            {/* Simple header */}
            <div style={{ background: "#4f46e5", color: "#fff", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Địa điểm du lịch gần đây</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8 }}>Khám phá các địa điểm nổi bật xung quanh khách sạn</p>
                </div>
                {data && (
                    <span style={{ fontSize: 13, opacity: 0.8 }}>{data.total} địa điểm</span>
                )}
            </div>

            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
                {/* Filters */}
                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 16, marginBottom: 24 }}>
                    {/* Category tabs */}
                    <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: "#6b7280", marginRight: 8 }}>Loại hình:</span>
                        <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                            {CATEGORIES.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => { setCategory(c.value); setPage(1); }}
                                    style={{
                                        border: "1px solid",
                                        borderColor: category === c.value ? "#4f46e5" : "#d1d5db",
                                        background: category === c.value ? "#4f46e5" : "#fff",
                                        color: category === c.value ? "#fff" : "#374151",
                                        borderRadius: 20, padding: "4px 14px", fontSize: 12, cursor: "pointer",
                                    }}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Distance presets */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>Khoảng cách:</span>
                        {[
                            { label: "Tất cả", value: "" },
                            { label: "Dưới 2 km", value: "2" },
                            { label: "Dưới 5 km", value: "5" },
                            { label: "Dưới 10 km", value: "10" },
                        ].map(d => (
                            <button
                                key={d.value}
                                onClick={() => { setMaxDistance(d.value); setPage(1); }}
                                style={{
                                    border: "1px solid",
                                    borderColor: maxDistance === d.value ? "#059669" : "#d1d5db",
                                    background: maxDistance === d.value ? "#059669" : "#fff",
                                    color: maxDistance === d.value ? "#fff" : "#374151",
                                    borderRadius: 20, padding: "4px 14px", fontSize: 12, cursor: "pointer",
                                }}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {loading && (
                    <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>Đang tải...</div>
                )}
                {error && (
                    <div style={{ textAlign: "center", padding: 40, color: "#ef4444" }}>
                        Lỗi: {error}
                    </div>
                )}
                {!loading && !error && data?.attractions?.length === 0 && (
                    <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
                        Không tìm thấy địa điểm nào.
                    </div>
                )}
                {!loading && !error && data?.attractions?.length > 0 && (
                    <>
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: 16,
                        }}>
                            {data.attractions.map(a => (
                                <AttractionCard key={a._id} attraction={a} onClick={setSelected} />
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ marginTop: 32, display: "flex", gap: 8, justifyContent: "center" }}>
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.4 : 1 }}
                                >
                                    ← Trước
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setPage(n)}
                                        style={{
                                            padding: "6px 12px", borderRadius: 6,
                                            border: "1px solid",
                                            borderColor: page === n ? "#4f46e5" : "#d1d5db",
                                            background: page === n ? "#4f46e5" : "#fff",
                                            color: page === n ? "#fff" : "#374151",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {n}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}
                                >
                                    Tiếp →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <AttractionDetailModal attraction={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
