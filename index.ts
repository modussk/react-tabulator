// 공개 API 배럴 (하위호환).
// 라이선스는 디렉터리 단위로 다름: core/ = MIT, pro/ = PolyForm SB 1.0.0 OR 상용. ./LICENSING.md 참고.
import { CORE_LANGS, mergeLangs } from "./core/i18n";
import { PRO_LANGS } from "./pro/i18n";

// ── core (MIT) ──
export { mergeLangs, reactFormatter, ReactTabulatorCore, useAntdTabulatorTheme } from "./core";
export type {
	ColumnDefinition,
	DataUpdateContext,
	DataUpdateResult,
	ReactTabulatorCoreProps,
	ReactTabulatorOptions,
} from "./core";

// ── pro (PolyForm SB 1.0.0 OR 상용) ──
export { createSparkBarFormatter, createSparkChartFormatter, ReactTabulatorPro } from "./pro";
export type {
	AddButtonConfig,
	ColumnSettingButtonConfig,
	DeleteButtonConfig,
	GridApi,
	HeaderToolbarConfig,
	ProColumnDefinition,
	QuickFilterConfig,
	ReactTabulatorLangTexts,
	ReactTabulatorProps,
	ResetButtonConfig,
	SparkBarColorFn,
	SparkBarOptions,
	SparkChartColorFn,
	SparkChartOptions,
	StatusBarConfig,
	ToolbarItemConfig,
	TransactionParams,
} from "./pro";
// 하위호환: 기존 default 컴포넌트(전체 기능) = 프로 컴포넌트
export { default as ReactTabulator } from "./pro/ReactTabulatorPro";

// 하위호환: 통합 사전 (코어 + 프로 병합본)
export const WRAPPER_LANGS = mergeLangs(CORE_LANGS, PRO_LANGS);
