import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
/**
 * 날짜 포맷팅 (한국 시간 기준)
 */
export function formatDate(date) {
    if (!date)
        return "-";
    const d = new Date(date);
    return d.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}
/**
 * 날짜/시간 포맷팅 (한국 시간 기준)
 */
export function formatDateTime(date) {
    if (!date)
        return "-";
    const d = new Date(date);
    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}
/**
 * 토큰 만료까지 남은 일수 계산
 */
export function getDaysUntilExpiry(expiresAt) {
    if (!expiresAt)
        return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}
/**
 * 토큰 상태에 따른 배지 스타일 반환
 */
export function getTokenStatusBadge(daysUntilExpiry) {
    if (daysUntilExpiry === null) {
        return { label: "미설정", className: "badge-info" };
    }
    if (daysUntilExpiry <= 0) {
        return { label: "만료됨", className: "badge-error" };
    }
    if (daysUntilExpiry <= 3) {
        return { label: `${daysUntilExpiry}일 남음`, className: "badge-error" };
    }
    if (daysUntilExpiry <= 7) {
        return { label: `${daysUntilExpiry}일 남음`, className: "badge-warning" };
    }
    if (daysUntilExpiry <= 14) {
        return { label: `${daysUntilExpiry}일 남음`, className: "badge-info" };
    }
    return { label: `${daysUntilExpiry}일 남음`, className: "badge-active" };
}
/**
 * AuthStatus 한글 변환
 */
export function getAuthStatusLabel(status) {
    const statusMap = {
        ACTIVE: "정상",
        AUTH_REQUIRED: "재인증 필요",
        TOKEN_EXPIRED: "토큰 만료",
        TOKEN_EXPIRING: "만료 임박",
    };
    return statusMap[status] || status;
}
/**
 * PlanType 한글 변환
 */
export function getPlanTypeLabel(planType) {
    const planMap = {
        FREE: "무료",
        BASIC: "기본",
        PREMIUM: "프리미엄",
        ENTERPRISE: "엔터프라이즈",
    };
    return planMap[planType] || planType;
}
