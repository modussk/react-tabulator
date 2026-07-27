// SPDX-License-Identifier: MIT
// 코어 다국어 사전.
// Tabulator 내장 Localize 모듈의 langs 사전을 단일 소스로 재사용한다:
// 코어 키(pagination/data/groups/headerFilters)는 Tabulator 가 setLocale 시 내부 binding 으로 자동 갱신된다.
// locale 해석은 Tabulator 규칙을 그대로 따른다: 정확 일치 → prefix 폴백("ko-kr"→"ko") → default(영어).

export const CORE_LANGS: Record<string, any> = {
	// 폴백(기본) 언어는 Tabulator 내장 영어 문자열을 그대로 사용 (default 재정의 없음)
	default: {},
	// 한국어 — Tabulator 코어 문자열 번역
	ko: {
		groups: { item: "건", items: "건" },
		data: { loading: "불러오는 중", error: "오류" },
		pagination: {
			page_size: "페이지 크기",
			page_title: "페이지 이동",
			first: "처음",
			first_title: "첫 페이지",
			last: "마지막",
			last_title: "마지막 페이지",
			prev: "이전",
			prev_title: "이전 페이지",
			next: "다음",
			next_title: "다음 페이지",
			all: "전체",
			counter: { showing: "표시", of: "/", rows: "행", pages: "페이지" },
		},
		headerFilters: { default: "필터..." },
	},
};

/** 사용자/상위 정의 langs 를 기본 사전 위에 깊은 병합 (나중 인자가 우선) */
export function mergeLangs(base: Record<string, any>, override?: Record<string, any>): Record<string, any> {
	if (!override) {
		return base;
	}
	const out: Record<string, any> = { ...base };
	for (const key of Object.keys(override)) {
		const b = out[key];
		const o = override[key];
		out[key] = b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(b) && !Array.isArray(o)
			? mergeLangs(b, o)
			: o;
	}
	return out;
}
