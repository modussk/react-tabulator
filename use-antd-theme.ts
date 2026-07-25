import type { TabulatorTokens } from "./tokens";

import { useId, useInsertionEffect, useMemo } from "react";
import { defaultTokens } from "./tokens";

/**
 * @zh Tabulator(기본 테마)를 Ant Design 톤으로 맞추기 위한 CSS 오버라이드 훅. (antd 의존 없음)
 *     반환된 클래스명을 <ReactTabulator className={...} /> 에 전달해 사용합니다.
 *     기본값은 로컬 토큰(라이트 톤). antd 를 쓰는 앱이라면 theme.useToken().token 을 인자로 넘겨 다크모드/커스텀 테마와 동기화할 수 있습니다.
 * @en Hook generating CSS overrides for the Ant Design look (no antd dependency).
 *     Pass the returned class name to <ReactTabulator className={...} />.
 *     Uses local default tokens (light tone). If your app uses antd, pass theme.useToken().token to sync dark/custom themes.
 */
export function useAntdTabulatorTheme(token: TabulatorTokens = defaultTokens) {
	const rawId = useId();
	const className = `antd-tabulator-${rawId.replace(/:/g, "")}`;
	const css = useMemo(() => buildCss(className, token), [className, token]);

	// CSS-in-JS 주입 전용 훅 (paint 이전에 실행되어 FOUC 방지)
	useInsertionEffect(() => {
		const styleEl = document.createElement("style");
		styleEl.dataset.antdTabulator = className;
		styleEl.textContent = css;
		document.head.appendChild(styleEl);
		return () => {
			styleEl.remove();
		};
	}, [css]);

	return { antdTabulator: className };
}

/** 토큰 기반으로 Tabulator 오버라이드 CSS 문자열을 생성 (모두 `.${cls}` 하위로 스코프) */
function buildCss(cls: string, token: TabulatorTokens): string {
	const c = `.${cls}`;
	const fontWeightStrong = token.fontWeightStrong ?? 600;
	const white = token.colorWhite ?? "#fff";
	// 헤더/frozen 컬럼용 "frosted glass" veil.
	// 컨테이너 색을 반투명으로 만들어(색감은 유지) sticky 고정 시 뒤로 스크롤/지나가는 내용이 완전히 비치지 않고
	// 흐릿하게(dimmed) 보이도록 함 → 가독성↑. 컨테이너 비율(95%)이 높을수록 뒤가 더 흐려짐(=투명도↓).
	// frostBase/frostHoverBase 는 color-mix 미지원 브라우저 폴백(기존 반투명 토큰).
	const frostBase = token.colorFillAlter;
	const frostVeil = `color-mix(in srgb, ${token.colorBgContainer} 95%, transparent)`;
	const frostHoverBase = token.controlItemBgHover ?? token.colorFillSecondary;
	const frostVeilHover = `color-mix(in srgb, ${frostHoverBase} 45%, ${frostVeil})`;
	// zebra 짝수 행 tint: frost veil 위에 background-image 로 덧칠해 frozen/rowHeader 컬럼에도 줄무늬를 유지(반투명 유지).
	const zebraTint = token.colorFillQuaternary ?? token.colorFillAlter;
	return [
		// 컨테이너 (header + table 을 감싼 단일 박스)
		`${c}{border:1px solid ${token.colorBorderSecondary} !important;border-radius:${token.borderRadiusLG}px;overflow:hidden;background-color:${token.colorBgContainer} !important;color:${token.colorText};font-family:${token.fontFamily};font-size:${token.fontSize}px;}`,

		// 상단 header 툴바 (테이블과 하나처럼 보이도록 하단 구분선으로 연결)
		`${c} .react-tabulator-header{padding:${token.paddingXS}px ${token.paddingSM}px;border-bottom:1px solid ${token.colorBorderSecondary};background-color:${token.colorBgContainer};}`,

		// 내부 tabulator 는 컨테이너가 테두리/모서리를 담당하므로 자체 테두리 제거
		`${c} .tabulator{border:none !important;border-radius:0 !important;background-color:transparent !important;}`,

		// 헤더
		`${c} .tabulator-header{background-color:${frostBase} !important;background-color:${frostVeil} !important;border-bottom:1px solid ${token.colorBorderSecondary} !important;color:${token.colorTextHeading} !important;font-weight:${fontWeightStrong};}`,
		`${c} .tabulator-header .tabulator-col{background-color:transparent !important;border-right:1px solid ${token.colorBorderSecondary} !important;}`,
		`${c} .tabulator-header .tabulator-col .tabulator-col-content{padding:${token.paddingXS}px ${token.paddingSM}px !important;}`,

		// 본문 행/셀
		`${c} .tabulator-tableholder .tabulator-table{background-color:${token.colorBgContainer} !important;color:${token.colorText} !important;}`,
		`${c} .tabulator-row{background-color:${token.colorBgContainer} !important;border-bottom:1px solid ${token.colorBorderSecondary} !important;}`,
		// zebra 스트라이프
		`${c} .tabulator-row.tabulator-row-even{background-color:${token.colorFillQuaternary ?? token.colorFillAlter} !important;}`,
		`${c} .tabulator-row:hover,${c} .tabulator-row.tabulator-selected{background-color:${token.controlItemBgHover ?? token.colorFillSecondary} !important;}`,
		`${c} .tabulator-cell{padding:${token.paddingXS}px ${token.paddingSM}px !important;border-right:1px solid ${token.colorBorderSecondary} !important;color:${token.colorText} !important;}`,
		// rowHeader(행번호) 셀: 경계선 + frosted veil(반투명, 뒤 흐림). range 하이라이트 규칙이 더 높은 우선순위라 선택 시 그 색이 이김.
		`${c} .tabulator-row .tabulator-cell.tabulator-row-header{border-right:1px solid ${token.colorBorderSecondary} !important;border-bottom:1px solid ${token.colorBorderSecondary} !important;background-color:${frostBase} !important;background-color:${frostVeil} !important;background-image:none !important;}`,
		// rowHeader 짝수 zebra: frost veil 위에 tint 덧칠 (줄무늬 유지)
		`${c} .tabulator-row.tabulator-row-even .tabulator-cell.tabulator-row-header{background-image:linear-gradient(${zebraTint},${zebraTint}) !important;}`,
		`${c} .tabulator-row:hover .tabulator-cell.tabulator-row-header{background-color:${frostHoverBase} !important;background-color:${frostVeilHover} !important;background-image:none !important;}`,
		// frozen 컬럼(코드 컬럼)과 헤더는 sticky 로 고정된다. 완전 불투명은 어색하므로, 반투명을 유지하되
		// veil 밀도를 높여(투명도↓) 뒤로 스크롤/지나가는 내용이 흐릿하게(dimmed) 비치도록 해 가독성을 높인다.
		// zebra 줄무늬는 짝수 행에 background-image tint 를 덧칠해 유지한다(다른 컬럼과 동일한 줄무늬).
		// - 헤더 frozen: 헤더와 동일한 frost veil (헤더는 단일 행이라 zebra 없음)
		`${c} .tabulator-header .tabulator-frozen{background-color:${frostBase} !important;background-color:${frostVeil} !important;}`,
		// - 본문 frozen(rowHeader 제외): 홀수(기본) frost veil
		`${c} .tabulator-row .tabulator-cell.tabulator-frozen:not(.tabulator-row-header){background-color:${frostBase} !important;background-color:${frostVeil} !important;background-image:none !important;}`,
		// - 본문 frozen: 짝수 zebra (frost veil 위에 tint 덧칠)
		`${c} .tabulator-row.tabulator-row-even .tabulator-cell.tabulator-frozen:not(.tabulator-row-header){background-image:linear-gradient(${zebraTint},${zebraTint}) !important;}`,
		// - 본문 frozen: hover (짝수 규칙과 동점 specificity → 뒤에 선언해 hover 가 이김, tint 제거)
		`${c} .tabulator-row:hover .tabulator-cell.tabulator-frozen:not(.tabulator-row-header){background-color:${frostHoverBase} !important;background-color:${frostVeilHover} !important;background-image:none !important;}`,

		// editor 로 값이 수정된 셀 강조 - 연한 붉은색
		`${c} .tabulator-row .tabulator-cell.tabulator-cell-edited{background-color:${token.colorErrorBg ?? "#fff1f0"} !important;}`,
		`${c} .tabulator-row:hover .tabulator-cell.tabulator-cell-edited{background-color:${token.colorErrorBgHover ?? "#fff1f0"} !important;}`,

		// 신규 추가된 행 (연한 파란색)
		`${c} .tabulator-row.rt-row-new{background-color:${token.colorPrimaryBg ?? "#e6f4ff"} !important;}`,
		`${c} .tabulator-row:hover.rt-row-new{background-color:${token.colorPrimaryBgHover ?? "#bae0ff"} !important;}`,
		
		// 삭제된 행 (취소선)
		`${c} .tabulator-row.rt-row-deleted, ${c} .tabulator-row.rt-row-deleted .tabulator-cell {text-decoration:line-through !important;color:${token.colorTextQuaternary ?? "#bfbfbf"} !important;}`,

		// flashOnChange: 데이터 갱신 시 변경 셀 플래시 (증가=초록 / 감소·비숫자=빨강 → 투명으로 페이드)
		`@keyframes rt-cell-flash-up{from{background-color:${token.colorSuccess ?? "#52c41a"};}to{background-color:transparent;}}`,
		`@keyframes rt-cell-flash-down{from{background-color:${token.colorError ?? "#ff4d4f"};}to{background-color:transparent;}}`,
		`${c} .tabulator-cell.rt-cell-flash-up{animation:rt-cell-flash-up var(--rt-flash-dur, 800ms) ease-out;}`,
		`${c} .tabulator-cell.rt-cell-flash-down{animation:rt-cell-flash-down var(--rt-flash-dur, 800ms) ease-out;}`,

		// 편집 중(editor) 셀: input/textarea/select 를 antd focus 스타일로 명확히 표시
		`${c} .tabulator-row .tabulator-cell.tabulator-editing{overflow:visible !important;z-index:10 !important;border-color:${token.colorPrimary} !important;padding:0 !important;background-color:${token.colorBgContainer} !important;}`,
		`${c} .tabulator-row .tabulator-cell.tabulator-editing input,${c} .tabulator-row .tabulator-cell.tabulator-editing textarea,${c} .tabulator-row .tabulator-cell.tabulator-editing select{width:100%;height:100%;box-sizing:border-box;padding:${token.paddingXXS ?? 4}px ${token.paddingSM}px;border:1px solid ${token.colorPrimary};border-radius:${token.borderRadiusSM ?? 4}px;background-color:${token.colorBgContainer};color:${token.colorText};font-size:${token.fontSize}px;line-height:${token.lineHeight};outline:none;box-shadow:0 0 0 2px ${token.controlOutline ?? "rgba(5, 145, 255, 0.1)"};}`,

		// 정렬 아이콘(커스텀 chevron) 색상: 미정렬은 흐리게, 정렬 활성 시 primary
		`${c} .rt-sort-icon{display:block;height:70%;width:auto;color:${token.colorTextQuaternary};}`,
		`${c} .tabulator-col[aria-sort='ascending'] .rt-sort-icon,${c} .tabulator-col[aria-sort='descending'] .rt-sort-icon{color:${token.colorPrimary};}`,

		// range 선택 강조 (antd 톤)
		`${c} .tabulator-tableholder .tabulator-range-overlay .tabulator-range{border-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-tableholder .tabulator-range-overlay .tabulator-range-cell-active{border-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-tableholder .tabulator-range-overlay .tabulator-range.tabulator-range-active::after{background-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-row .tabulator-cell.tabulator-range-selected:not(.tabulator-range-only-cell-selected):not(.tabulator-range-row-header){background-color:${token.colorPrimaryBg ?? token.controlItemBgActive} !important;}`,
		`${c} .tabulator-header .tabulator-col.tabulator-range-highlight{background-color:${token.colorFillSecondary} !important;color:${token.colorText} !important;}`,
		`${c} .tabulator-header .tabulator-col.tabulator-range-selected{background-color:${token.colorPrimary} !important;color:${white} !important;}`,
		// rowHeader 의 zebra/hover 규칙(specificity 5)보다 확실히 우선하도록 .tabulator-row-header 를 함께 명시(6)
		// range-highlight 색(colorFill)은 반투명이라 그대로 쓰면 frost veil 이 사라져 뒤가 비친다.
		// → frost veil 을 배경으로 깔고 하이라이트 tint 를 background-image 로 덧칠(반투명 유지 + 흐림 유지).
		`${c} .tabulator-row.tabulator-range-highlight .tabulator-cell.tabulator-range-row-header.tabulator-row-header{background-color:${frostBase} !important;background-color:${frostVeil} !important;background-image:linear-gradient(${token.colorFill},${token.colorFill}) !important;color:${token.colorText} !important;font-weight:${fontWeightStrong};}`,
		`${c} .tabulator-row.tabulator-range-selected .tabulator-cell.tabulator-range-row-header.tabulator-row-header{background-color:${token.colorPrimary} !important;color:${white} !important;}`,

		// 링크 셀
		`${c} .tabulator-link{color:${token.colorLink};cursor:pointer;}`,
		`${c} .tabulator-link:hover{color:${token.colorLinkHover};text-decoration:underline;}`,

		// 푸터/페이지네이션
		`${c} .tabulator-footer{background-color:${token.colorBgContainer} !important;border-top:1px solid ${token.colorBorderSecondary} !important;color:${token.colorText} !important;}`,
		`${c} .tabulator-footer .tabulator-footer-contents{gap:${token.margin}px;}`,
		`${c} .tabulator-footer .tabulator-page{margin:2px;padding:2px 8px;color:${token.colorText} !important;background:${token.colorBgContainer} !important;border:1px solid ${token.colorBorder} !important;border-radius:${token.borderRadius}px !important;}`,
		`${c} .tabulator-footer .tabulator-page:not(.disabled):hover{color:${token.colorPrimary} !important;border-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-footer .tabulator-page.active{color:${token.colorPrimary} !important;border-color:${token.colorPrimary} !important;}`,
	].join("\n");
}
