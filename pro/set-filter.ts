// SPDX-License-Identifier: MIT
// Set Filter (엑셀식 고유값 체크박스 필터) — AG Grid Enterprise 의 Set Filter 대응.
// 컬럼 정의에 `setFilter: true` 를 지정하면 헤더에 깔때기 아이콘이 표시되고,
// 클릭 시 해당 컬럼의 고유값 체크박스 목록(검색 + 전체 선택)이 팝업으로 열린다.
// 팝업 자체는 Tabulator 코어의 headerPopup 모듈(위치/외부클릭 처리)을 사용하고,
// 내용은 바닐라 DOM 으로 구성한다 — 팝업이 body 에 부착되어 테마 스코프 밖이므로
// 프레임은 Tabulator 기본 팝업 스타일, 내부는 인라인 스타일을 쓴다.

export interface SetFilterTexts {
	/** 값 검색 입력 placeholder */
	search: string
	/** 전체 선택 라벨 */
	selectAll: string
	/** 빈 값(null/undefined/"") 표시 라벨 */
	empty: string
	/** 고유값 상한 초과 안내 ("{n}" 이 생략 개수로 치환됨) */
	overflow: string
}

export interface SetFilterHost {
	/** 필터 대상 원본 행 데이터 */
	getRows: () => any[]
	/** field 별 현재 선택 상태 (null = 필터 없음(전체 허용)) */
	getSelected: (field: string) => Set<string> | null
	/** 선택 변경 통지 (null = 필터 해제) — 호출측에서 필터 재적용 */
	setSelected: (field: string, values: Set<string> | null) => void
	getTexts: () => SetFilterTexts
}

// 고유값 나열 상한 (성능 보호 — 초과분은 안내 문구로 표시)
const MAX_VALUES = 1000;

/** 셀 값 → 필터 키 (null/undefined → "" = 빈 값 그룹) */
export function setFilterValueKey(v: any): string {
	return v == null ? "" : String(v);
}

/** 중첩 경로 접근 ("a.b.c") */
export function getByPath(obj: any, path: string): any {
	if (!path.includes(".")) {
		return obj?.[path];
	}
	return path.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);
}

/** 헤더 깔때기 아이콘 (headerPopupIcon 용, currentColor 상속) */
export const SET_FILTER_ICON_HTML
	= "<svg viewBox=\"0 0 24 24\" width=\"1em\" height=\"1em\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" style=\"vertical-align:-0.125em\"><path d=\"M4 5h16l-6.5 7.5V19l-3-1.5v-5L4 5z\"/></svg>";

// 인라인 스타일 헬퍼
function styled<T extends HTMLElement>(el: T, style: Partial<CSSStyleDeclaration>): T {
	Object.assign(el.style, style);
	return el;
}

/**
 * Tabulator `headerPopup` 콘텐츠 빌더를 생성한다.
 * 반환 함수는 팝업이 열릴 때마다 호출되어 현재 데이터의 고유값으로 UI 를 다시 만든다.
 */
export function createSetFilterPopup(host: SetFilterHost) {
	return (_e: any, column: any, _onRendered: any): HTMLElement => {
		const field: string = column.getField?.() ?? "";
		const texts = host.getTexts();

		// 고유값 수집 → 숫자 인식 문자열 정렬
		const uniques = new Set<string>();
		for (const row of host.getRows()) {
			uniques.add(setFilterValueKey(getByPath(row, field)));
		}
		const keys = Array.from(uniques).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
		const visibleKeys = keys.slice(0, MAX_VALUES);
		const overflow = keys.length - visibleKeys.length;

		// 현재 선택 상태 (null = 전체 허용 → 모든 키 체크로 표시)
		const selected = host.getSelected(field);
		const checked = new Set<string>(selected ?? keys);
		const itemInputs = new Map<string, HTMLInputElement>();
		const itemLabels = new Map<string, HTMLLabelElement>();

		const container = styled(document.createElement("div"), {
			display: "flex",
			flexDirection: "column",
			gap: "6px",
			padding: "4px",
			minWidth: "200px",
			fontSize: "13px",
		});
		container.classList.add("rt-set-filter");

		// 값 검색 입력 (목록 표시 필터링)
		const search = styled(document.createElement("input"), {
			padding: "4px 8px",
			border: "1px solid #d9d9d9",
			borderRadius: "6px",
			outline: "none",
		});
		search.type = "text";
		search.placeholder = texts.search;
		container.appendChild(search);

		// 전체 선택
		const selectAllLabel = styled(document.createElement("label"), {
			display: "flex",
			alignItems: "center",
			gap: "6px",
			padding: "2px 0",
			borderBottom: "1px solid #f0f0f0",
			cursor: "pointer",
			fontWeight: "600",
		});
		const selectAllInput = document.createElement("input");
		selectAllInput.type = "checkbox";
		selectAllLabel.appendChild(selectAllInput);
		selectAllLabel.appendChild(document.createTextNode(texts.selectAll));
		container.appendChild(selectAllLabel);

		const syncSelectAll = () => {
			selectAllInput.checked = checked.size >= keys.length;
			selectAllInput.indeterminate = checked.size > 0 && checked.size < keys.length;
		};

		// 변경 즉시 적용: 전부 체크되면 "필터 없음"(null) 으로 정규화
		const apply = () => {
			host.setSelected(field, checked.size >= keys.length ? null : new Set(checked));
			syncSelectAll();
		};

		selectAllInput.addEventListener("change", () => {
			checked.clear();
			if (selectAllInput.checked) {
				keys.forEach(k => checked.add(k));
			}
			itemInputs.forEach((input, key) => {
				input.checked = checked.has(key);
			});
			apply();
		});

		// 고유값 체크박스 목록
		const list = styled(document.createElement("div"), {
			display: "flex",
			flexDirection: "column",
			gap: "2px",
			maxHeight: "240px",
			overflow: "auto",
		});
		container.appendChild(list);

		for (const key of visibleKeys) {
			const label = styled(document.createElement("label"), {
				display: "flex",
				alignItems: "center",
				gap: "6px",
				padding: "1px 0",
				cursor: "pointer",
			});
			const input = document.createElement("input");
			input.type = "checkbox";
			input.checked = checked.has(key);
			input.addEventListener("change", () => {
				if (input.checked) {
					checked.add(key);
				}
				else {
					checked.delete(key);
				}
				apply();
			});
			label.appendChild(input);
			const text = document.createElement("span");
			text.textContent = key === "" ? texts.empty : key;
			if (key === "") {
				text.style.color = "#999";
			}
			label.appendChild(text);
			list.appendChild(label);
			itemInputs.set(key, input);
			itemLabels.set(key, label);
		}

		// 상한 초과 안내
		if (overflow > 0) {
			const note = styled(document.createElement("div"), { color: "#999", padding: "2px 0" });
			note.textContent = texts.overflow.replace("{n}", String(overflow));
			container.appendChild(note);
		}

		// 검색어로 목록 표시 필터링 (대소문자 무시 부분일치)
		search.addEventListener("input", () => {
			const needle = search.value.trim().toLowerCase();
			itemLabels.forEach((label, key) => {
				const haystack = key === "" ? texts.empty.toLowerCase() : key.toLowerCase();
				const shown = !needle || haystack.includes(needle);
				label.style.display = shown ? "flex" : "none";
			});
		});

		syncSelectAll();
		return container;
	};
}
