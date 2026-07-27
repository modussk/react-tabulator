// SPDX-License-Identifier: PolyForm-Small-Business-1.0.0 OR LicenseRef-Commercial
// 프로 툴바 다국어 사전.
// 코어와 같은 Tabulator langs 사전에 `reactTabulator` 네임스페이스로 얹고,
// 프로 컴포넌트가 `localized` 이벤트를 받아 React 툴바를 재렌더한다.

/** 프로 툴바 전용 문자열 키 */
export interface ReactTabulatorLangTexts {
	quickFilterPlaceholder: string
	addRow: string
	/** 행 추가 시 정렬/필터/페이지 초기화 확인 문구 */
	addRowResetConfirm: string
	deleteRow: string
	resetData: string
	/** 초기화 버튼 클릭 시 초기 데이터 원복 확인 문구 */
	resetDataConfirm: string
	columnSetting: string
	persistColumns: string
	/** set filter: 값 검색 placeholder */
	setFilterSearch: string
	/** set filter: 전체 선택 라벨 */
	setFilterSelectAll: string
	/** set filter: 빈 값 라벨 */
	setFilterEmpty: string
	/** set filter: 고유값 상한 초과 안내 ({n} = 생략 개수) */
	setFilterOverflow: string
	/** 상태바: 선택 셀 개수 라벨 */
	statusCount: string
	/** 상태바: 합계 라벨 */
	statusSum: string
	/** 상태바: 평균 라벨 */
	statusAvg: string
	/** 상태바: 최소 라벨 */
	statusMin: string
	/** 상태바: 최대 라벨 */
	statusMax: string
}

export const PRO_LANGS: Record<string, any> = {
	// 폴백(기본) 언어: 영어
	default: {
		reactTabulator: {
			quickFilterPlaceholder: "Search",
			addRow: "Add",
			addRowResetConfirm: "Adding a new row will reset sorting, search filter, and page position. Continue?",
			deleteRow: "Delete",
			resetData: "Reset",
			resetDataConfirm: "This will discard all changes (edits, added and deleted rows) and restore the initial data. Sorting, search filter, and page position will also be reset. Continue?",
			columnSetting: "Columns",
			persistColumns: "Save column settings",
			setFilterSearch: "Search values",
			setFilterSelectAll: "Select all",
			setFilterEmpty: "(Blanks)",
			setFilterOverflow: "+{n} more values not shown",
			statusCount: "Count",
			statusSum: "Sum",
			statusAvg: "Average",
			statusMin: "Min",
			statusMax: "Max",
		},
	},
	ko: {
		reactTabulator: {
			quickFilterPlaceholder: "검색",
			addRow: "추가",
			addRowResetConfirm: "행을 추가하면 정렬, 검색 필터, 페이지 위치가 초기화됩니다. 계속할까요?",
			deleteRow: "삭제",
			resetData: "초기화",
			resetDataConfirm: "모든 변경사항(수정·추가·삭제)이 취소되고 초기 데이터로 되돌아갑니다. 정렬, 검색 필터, 페이지 위치도 초기화됩니다. 계속할까요?",
			columnSetting: "열 설정",
			persistColumns: "열 설정 저장",
			setFilterSearch: "값 검색",
			setFilterSelectAll: "전체 선택",
			setFilterEmpty: "(빈 값)",
			setFilterOverflow: "+{n}개 값 생략됨",
			statusCount: "개수",
			statusSum: "합계",
			statusAvg: "평균",
			statusMin: "최소",
			statusMax: "최대",
		},
	},
};

export const DEFAULT_WRAPPER_TEXTS: ReactTabulatorLangTexts = PRO_LANGS.default.reactTabulator;

/**
 * locale 에 해당하는 툴바 문자열을 사전에서 해석한다 (Tabulator 의 locale 해석 규칙과 동일).
 * 인스턴스 생성 전(최초 렌더)의 초기 텍스트 계산용 — 생성 후에는 `localized` 이벤트의 getLang() 이 소스.
 */
export function resolveWrapperTexts(locale: string | boolean | undefined, langs: Record<string, any>): ReactTabulatorLangTexts {
	let loc = locale === true
		? (typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "")
		: (typeof locale === "string" ? locale.toLowerCase() : "");
	if (loc && !langs[loc]) {
		loc = loc.split("-")[0];
	}
	return {
		...DEFAULT_WRAPPER_TEXTS,
		...langs.default?.reactTabulator,
		...(loc ? langs[loc]?.reactTabulator : undefined),
	};
}
