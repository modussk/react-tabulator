import { theme } from "antd";
import { useId, useInsertionEffect, useMemo } from "react";

const { useToken } = theme;

/**
 * @zh Tabulator(기본 테마)를 Ant Design 톤으로 맞추기 위한 CSS 오버라이드 훅.
 *     반환된 클래스명을 <ReactTabulator className={...} /> 에 전달해 사용합니다.
 *     antd 의 theme.useToken() 으로 토큰을 직접 읽으므로 별도의 ThemeProvider(react-jss 등) 설정이 필요 없습니다.
 * @en Hook that generates CSS overrides aligning Tabulator's default theme with the Ant Design look.
 *     Pass the returned class name to <ReactTabulator className={...} />.
 *     Reads design tokens via antd's theme.useToken() directly, so no extra ThemeProvider (e.g. react-jss) is required.
 */
export function useAntdTabulatorTheme() {
	const { token } = useToken();
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

/** antd 토큰 기반으로 Tabulator 오버라이드 CSS 문자열을 생성 (모두 `.${cls}` 하위로 스코프) */
function buildCss(cls: string, token: any): string {
	const c = `.${cls}`;
	const fontWeightStrong = token.fontWeightStrong ?? 600;
	const white = token.colorWhite ?? "#fff";
	return [
		// 컨테이너 (header + table 을 감싼 단일 박스)
		`${c}{border:1px solid ${token.colorBorderSecondary} !important;border-radius:${token.borderRadiusLG}px;overflow:hidden;background-color:${token.colorBgContainer} !important;color:${token.colorText};font-family:${token.fontFamily};font-size:${token.fontSize}px;}`,

		// 상단 header 툴바 (테이블과 하나처럼 보이도록 하단 구분선으로 연결)
		`${c} .react-tabulator-header{padding:${token.paddingXS}px ${token.paddingSM}px;border-bottom:1px solid ${token.colorBorderSecondary};background-color:${token.colorBgContainer};}`,

		// 내부 tabulator 는 컨테이너가 테두리/모서리를 담당하므로 자체 테두리 제거
		`${c} .tabulator{border:none !important;border-radius:0 !important;background-color:transparent !important;}`,

		// 헤더
		`${c} .tabulator-header{background-color:${token.colorFillAlter} !important;border-bottom:1px solid ${token.colorBorderSecondary} !important;color:${token.colorTextHeading} !important;font-weight:${fontWeightStrong};}`,
		`${c} .tabulator-header .tabulator-col{background-color:transparent !important;border-right:1px solid ${token.colorBorderSecondary} !important;}`,
		`${c} .tabulator-header .tabulator-col .tabulator-col-content{padding:${token.paddingXS}px ${token.paddingSM}px !important;}`,

		// 본문 행/셀
		`${c} .tabulator-tableholder .tabulator-table{background-color:${token.colorBgContainer} !important;color:${token.colorText} !important;}`,
		`${c} .tabulator-row{background-color:${token.colorBgContainer} !important;border-bottom:1px solid ${token.colorBorderSecondary} !important;}`,
		// zebra 스트라이프
		`${c} .tabulator-row.tabulator-row-even{background-color:${token.colorFillQuaternary ?? token.colorFillAlter} !important;}`,
		`${c} .tabulator-row:hover,${c} .tabulator-row.tabulator-selected{background-color:${token.controlItemBgHover ?? token.colorFillSecondary} !important;}`,
		`${c} .tabulator-cell{padding:${token.paddingXS}px ${token.paddingSM}px !important;border-right:1px solid ${token.colorBorderSecondary} !important;color:${token.colorText} !important;}`,
		// rowHeader(행번호) 셀 경계선을 다른 셀과 동일하게
		`${c} .tabulator-row .tabulator-cell.tabulator-row-header{border-right:1px solid ${token.colorBorderSecondary} !important;border-bottom:1px solid ${token.colorBorderSecondary} !important;}`,

		// editor 로 값이 수정된 셀 강조 - 연한 붉은색
		`${c} .tabulator-row .tabulator-cell.tabulator-cell-edited{background-color:${token.colorErrorBg ?? "#fff1f0"} !important;}`,
		`${c} .tabulator-row:hover .tabulator-cell.tabulator-cell-edited{background-color:${token.colorErrorBgHover ?? "#fff1f0"} !important;}`,

		// 편집 중(editor) 셀: input/textarea/select 를 antd focus 스타일로 명확히 표시
		`${c} .tabulator-row .tabulator-cell.tabulator-editing{overflow:visible !important;z-index:10 !important;border-color:${token.colorPrimary} !important;padding:0 !important;background-color:${token.colorBgContainer} !important;}`,
		`${c} .tabulator-row .tabulator-cell.tabulator-editing input,${c} .tabulator-row .tabulator-cell.tabulator-editing textarea,${c} .tabulator-row .tabulator-cell.tabulator-editing select{width:100%;height:100%;box-sizing:border-box;padding:${token.paddingXXS ?? 4}px ${token.paddingSM}px;border:1px solid ${token.colorPrimary};border-radius:${token.borderRadiusSM ?? 4}px;background-color:${token.colorBgContainer};color:${token.colorText};font-size:${token.fontSize}px;line-height:${token.lineHeight};outline:none;box-shadow:0 0 0 2px ${token.controlOutline ?? "rgba(5, 145, 255, 0.1)"};}`,

		// 정렬 화살표 색상
		`${c} .tabulator-col .tabulator-arrow{border-bottom-color:${token.colorTextQuaternary} !important;}`,
		`${c} .tabulator-col[aria-sort='ascending'] .tabulator-arrow{border-bottom-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-col[aria-sort='descending'] .tabulator-arrow{border-top-color:${token.colorPrimary} !important;}`,

		// range 선택 강조 (antd 톤)
		`${c} .tabulator-tableholder .tabulator-range-overlay .tabulator-range{border-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-tableholder .tabulator-range-overlay .tabulator-range-cell-active{border-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-tableholder .tabulator-range-overlay .tabulator-range.tabulator-range-active::after{background-color:${token.colorPrimary} !important;}`,
		`${c} .tabulator-row .tabulator-cell.tabulator-range-selected:not(.tabulator-range-only-cell-selected):not(.tabulator-range-row-header){background-color:${token.colorPrimaryBg ?? token.controlItemBgActive} !important;}`,
		`${c} .tabulator-header .tabulator-col.tabulator-range-highlight{background-color:${token.colorFillSecondary} !important;color:${token.colorText} !important;}`,
		`${c} .tabulator-header .tabulator-col.tabulator-range-selected{background-color:${token.colorPrimary} !important;color:${white} !important;}`,
		`${c} .tabulator-row.tabulator-range-highlight .tabulator-cell.tabulator-range-row-header{background-color:${token.colorFill} !important;color:${token.colorText} !important;font-weight:${fontWeightStrong};}`,
		`${c} .tabulator-row.tabulator-range-selected .tabulator-cell.tabulator-range-row-header{background-color:${token.colorPrimary} !important;color:${white} !important;}`,

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
