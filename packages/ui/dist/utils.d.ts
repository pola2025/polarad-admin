import { type ClassValue } from "clsx";
export declare function cn(...inputs: ClassValue[]): string;
/**
 * 날짜 포맷팅 (한국 시간 기준)
 */
export declare function formatDate(date: Date | string | null | undefined): string;
/**
 * 날짜/시간 포맷팅 (한국 시간 기준)
 */
export declare function formatDateTime(date: Date | string | null | undefined): string;
/**
 * 토큰 만료까지 남은 일수 계산
 */
export declare function getDaysUntilExpiry(expiresAt: Date | string | null | undefined): number | null;
/**
 * 토큰 상태에 따른 배지 스타일 반환
 */
export declare function getTokenStatusBadge(daysUntilExpiry: number | null): {
    label: string;
    className: string;
};
/**
 * AuthStatus 한글 변환
 */
export declare function getAuthStatusLabel(status: string): string;
/**
 * PlanType 한글 변환
 */
export declare function getPlanTypeLabel(planType: string): string;
