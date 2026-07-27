// SPDX-License-Identifier: MIT
/**
 * @zh ReactTabulator 스타일에 사용하는 디자인 토큰. antd 의존 없이 자체 기본값(Ant Design 라이트 톤)을 제공합니다.
 *     앱에서 antd 를 쓰는 경우 `useAntdTabulatorTheme(token)` 인자로 antd 토큰을 넘겨 다크모드/커스텀 테마와 동기화할 수 있습니다.
 * @en Design tokens used by ReactTabulator styling. Provides self-contained defaults (Ant Design light tone) with no antd dependency.
 *     If your app uses antd, pass its token into `useAntdTabulatorTheme(token)` to sync dark mode / custom themes.
 */
export interface TabulatorTokens {
	colorPrimary: string
	colorPrimaryBg: string
	colorText: string
	colorTextHeading: string
	colorTextTertiary: string
	colorTextQuaternary: string
	colorBorder: string
	colorBorderSecondary: string
	colorBgContainer: string
	colorBgElevated: string
	colorFillAlter: string
	colorFillSecondary: string
	colorFillQuaternary: string
	colorFill: string
	colorErrorBg: string
	colorErrorBgHover: string
	colorSuccessBg: string
	colorSuccess: string
	colorError: string
	controlItemBgHover: string
	controlItemBgActive: string
	controlOutline: string
	colorLink: string
	colorLinkHover: string
	colorWhite: string
	borderRadius: number
	borderRadiusLG: number
	borderRadiusSM: number
	fontSize: number
	fontFamily: string
	/** 고정폭(코드/숫자) 셀용 폰트. 컬럼 cssClass "rt-mono" 에 적용 (antd 의 fontFamilyCode 와 동일 의미) */
	fontFamilyCode?: string
	lineHeight: number
	fontWeightStrong: number
	padding: number
	paddingSM: number
	paddingXS: number
	paddingXXS: number
	margin: number
	marginXS: number
	marginXXS: number
	controlHeight: number
	controlHeightSM: number
	motionDurationMid: string
	boxShadowSecondary: string
}

/** Ant Design 기본(라이트) 테마와 유사한 톤의 기본 토큰 */
export const defaultTokens: TabulatorTokens = {
	colorPrimary: "#1677ff",
	colorPrimaryBg: "#e6f4ff",
	colorText: "rgba(0, 0, 0, 0.88)",
	colorTextHeading: "rgba(0, 0, 0, 0.88)",
	colorTextTertiary: "rgba(0, 0, 0, 0.45)",
	colorTextQuaternary: "rgba(0, 0, 0, 0.25)",
	colorBorder: "#d9d9d9",
	colorBorderSecondary: "#f0f0f0",
	colorBgContainer: "#ffffff",
	colorBgElevated: "#ffffff",
	colorFillAlter: "rgba(0, 0, 0, 0.02)",
	colorFillSecondary: "rgba(0, 0, 0, 0.06)",
	colorFillQuaternary: "rgba(0, 0, 0, 0.02)",
	colorFill: "rgba(0, 0, 0, 0.15)",
	colorErrorBg: "#fff2f0",
	colorErrorBgHover: "#fff1f0",
	colorSuccessBg: "#f6ffed",
	colorSuccess: "#52c41a",
	colorError: "#ff4d4f",
	controlItemBgHover: "rgba(0, 0, 0, 0.04)",
	controlItemBgActive: "#e6f4ff",
	controlOutline: "rgba(5, 145, 255, 0.1)",
	colorLink: "#1677ff",
	colorLinkHover: "#69b1ff",
	colorWhite: "#ffffff",
	borderRadius: 6,
	borderRadiusLG: 8,
	borderRadiusSM: 4,
	fontSize: 14,
	fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
	fontFamilyCode: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace",
	lineHeight: 1.5714285714285714,
	fontWeightStrong: 600,
	padding: 16,
	paddingSM: 12,
	paddingXS: 8,
	paddingXXS: 4,
	margin: 16,
	marginXS: 8,
	marginXXS: 4,
	controlHeight: 32,
	controlHeightSM: 24,
	motionDurationMid: "0.2s",
	boxShadowSecondary: "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)",
};
