import type { CSSProperties } from "react";
import type { Tabulator as TabulatorTypes } from "./types/TabulatorTypes";

import { useDebounceFn } from "ahooks";
import Fuse from "fuse.js";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import { propsToOptions } from "./ConfigUtils";
import { Button, Checkbox, Divider, Input, Popover, Switch } from "./primitives";
import { sweepReactRoots } from "./react-formatter";
import "tabulator-tables/dist/css/tabulator.min.css";

export interface ReactTabulatorOptions extends TabulatorTypes.Options {
	[k: string]: any
}

export interface ColumnDefinition extends TabulatorTypes.ColumnDefinition {}

export interface TransactionParams {
	add?: any[]
	addIndex?: number | boolean
	update?: any[]
	remove?: any[]
}

export interface GridApi {
	applyTransaction: (transaction: TransactionParams) => { add: any[]; update: any[]; remove: any[] }
	getNewRowsData: () => any[]
	getDeletedRowsData: () => any[]
}

export interface ReactTabulatorProps {
	/** 고유 식별자(PK)로 사용할 필드명 (필수) */
	idField: string
	columns?: ColumnDefinition[]
	data?: any[]
	options?: any
	events?: Record<string, (...args: any[]) => void>
	className?: string
	style?: CSSProperties
	/** 엄격하게 제어된 GridApi 객체를 전달 (또는 ref 훅 사용 권장) */
	onRef?: (ref: React.RefObject<GridApi> | { current: GridApi }) => void
	/**
	 * @zh 상단 header 툴바 설정. 지정하면 테이블 위에 header 를 렌더링하여 왼쪽에 quick filter,
	 *     오른쪽에 열 설정(columnSetting)을 배치합니다. 미지정(undefined)이면 header 를 표시하지 않습니다.
	 * @en Top header toolbar config. When provided, renders a header above the table (quick filter on the left,
	 *     column-setting on the right). If undefined, no header is shown.
	 */
	headerToolbar?: HeaderToolbarConfig
	/**
	 * @zh 컬럼 표시/숨김 상태를 localStorage 에 저장/복원할 키. 지정 시 컬럼 가시성 변경을 자동 저장하고,
	 *     재진입(빌드) 시 저장된 상태를 복원합니다.
	 * @en localStorage key to persist/restore column visibility. When set, column visibility changes are
	 *     auto-saved and restored on re-entry (build).
	 */
	persistKey?: string
	/**
	 * @zh 행번호(전체 순번) 컬럼 표시 여부. false 이면 행번호 컬럼을 숨깁니다.
	 * @en Whether to show the row-number(global sequence) column. Set false to hide it.
	 * @default true
	 */
	rowNumber?: boolean
	/**
	 * @zh 데이터 갱신 시 값이 바뀐 셀을 잠깐 플래시(애니메이션)로 강조. 숫자 증가=초록, 감소=빨강, 그 외(비숫자)=빨강.
	 *     행 매칭은 Tabulator `index`(기본 "id") 필드 기준이므로 데이터에 안정적 id 가 있어야 합니다.
	 * @en Flash cells whose value changed on data update. numeric up=green, down=red, non-numeric=red.
	 *     Rows are matched by the Tabulator `index` field (default "id").
	 * @default false
	 */
	flashOnChange?: boolean
	/** flash 지속 시간(ms, 기본 800) */
	flashDuration?: number
	/**
	 * @zh 데이터(data prop) 갱신을 requestAnimationFrame 으로 coalescing. 한 프레임 안에 여러 번 data 가 바뀌어도
	 *     최신값 1건으로 합쳐 프레임당 최대 1회만 테이블을 갱신/재렌더합니다. 고빈도(수~수십 Hz) 실시간 갱신에서
	 *     재렌더 오버헤드를 크게 줄여줍니다. flash diff 는 "마지막 렌더 대비 순변화" 기준이 됩니다.
	 * @en Coalesce data(prop) updates via requestAnimationFrame — multiple changes within one frame collapse into a
	 *     single update/redraw (latest wins). Greatly reduces re-render overhead under high-frequency (10s of Hz) updates.
	 *     flash diff then reflects the net change since the last rendered frame.
	 * @default false
	 */
	coalesceUpdates?: boolean
	/**
	 * @zh 재정렬 등으로 행 위치가 바뀔 때 옛 위치→새 위치로 부드럽게 이동하는 애니메이션(AG Grid animateRows 유사).
	 *     Tabulator 네이티브 기능이 아니라 FLIP 기법으로 구현. 가상 스크롤 특성상 갱신 전·후 모두 뷰포트에
	 *     보이는 행만 연출됩니다(뷰포트/페이지 밖으로 이동하는 행은 연출 안 됨).
	 * @en Smoothly slide rows from old to new position when they reorder (like AG Grid's animateRows).
	 *     Implemented via FLIP (Tabulator has no native option). Only rows visible before AND after animate.
	 * @default true
	 */
	animateRows?: boolean
	/** 행 이동 애니메이션 지속 시간(ms, 기본 250) */
	animateRowsDuration?: number
	/**
	 * @zh 열 설정 메뉴에서 열을 표시/숨길 때, 좌우로 밀리는 열들을 부드럽게 슬라이드시키는 애니메이션.
	 *     FLIP(가로 translateX) 기법으로 구현. 표시/숨김 대상 열 자체는 즉시 나타남/사라짐, 나머지 열이 슬라이드됩니다.
	 * @en Slide columns smoothly when showing/hiding a column from the column-setting menu (FLIP via translateX).
	 * @default true
	 */
	animateCols?: boolean
	/** 열 표시/숨김 애니메이션 지속 시간(ms, 기본 250) */
	animateColsDuration?: number
	/**
	 * @zh 테이블 최초 렌더링 시 첫 번째 셀 자동 선택 여부.
	 *     false일 경우 사용자가 직접 표를 클릭하기 전까진 선택된 상태로 보이지 않습니다.
	 * @default false
	 */
	autoSelectFirstCell?: boolean
	[k: string]: any
}

/** quick filter 세부 설정 */
export interface QuickFilterConfig {
	/** 검색 대상 필드. 미지정 시 field 를 가진 모든 leaf 컬럼 */
	keys?: string[]
	/** placeholder 텍스트 (기본 "검색") */
	placeholder?: string
	/** 검색 실행 debounce (ms, 기본 250) */
	debounce?: number
	/** true 이면 fuzzy 대신 대소문자 무시 완전 부분일치(substring) 검색 (기본 false) */
	exact?: boolean
}

/** 상단 header 툴바 설정 */
export interface HeaderToolbarConfig {
	/**
	 * @zh quick filter 입력창(header 왼쪽). true/false 또는 세부 설정 객체. 미지정 시 표시(true).
	 * @en Quick filter input (header-left). boolean or a config object. Defaults to shown (true).
	 */
	quickFilter?: boolean | QuickFilterConfig
	/**
	 * @zh 내장 열 설정 UI(열 표시/숨김 + 저장 스위치) 표시 여부. header 오른쪽에 렌더링됩니다.
	 *     저장 스위치는 persistKey 가 지정된 경우 나타납니다.
	 * @en Whether to show the built-in column-settings UI.
	 * @default false
	 */
	columnSetting?: boolean
	/**
	 * @zh 행 추가(Plus) 및 삭제(Minus) 버튼 표시 여부. 
	 *     신규 행은 옅은 파란색으로, 삭제된 행은 취소선으로 표시되며 실제 데이터는 유지됩니다.
	 * @en Show Plus/Minus action buttons for row management.
	 * @default false
	 */
	rowActions?: boolean
}

// 열 설정 UI 의 컬럼 노드 (leaf 또는 group, group 은 재귀 중첩 가능)
interface ColumnLeaf { field: string, title: string, visible: boolean }
interface ColumnGroup { group: true, title: string, children: ColumnNode[] }
type ColumnNode = ColumnLeaf | ColumnGroup;

/** 노드(및 하위 group)의 모든 leaf 를 재귀 수집 */
function gatherLeaves(node: ColumnNode): ColumnLeaf[] {
	return "group" in node ? node.children.flatMap(gatherLeaves) : [node];
}

// 내장 persistence 저장 키 규칙: `${persistenceID}-${type}` (type 예: "columns")
const persistStorageKey = (id: string, type: string) => `${id}-${type}`;
// persistence 로 저장하는 상태 타입들 (off 시 일괄 제거용)
const PERSIST_TYPES = ["columns", "sort", "group", "page", "headerFilter"] as const;

// @ant-design/icons 의존 제거를 위한 로컬 인라인 SVG 아이콘 (currentColor + 1em 크기)
function SearchIcon() {
	return (
		<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
			<circle cx="11" cy="11" r="7" />
			<line x1="16.5" y1="16.5" x2="21" y2="21" />
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}

function MinusIcon() {
	return (
		<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
	);
}

function SettingIcon() {
	return (
		<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden focusable={false}>
			<line x1="4" y1="7" x2="20" y2="7" />
			<line x1="4" y1="12" x2="20" y2="12" />
			<line x1="4" y1="17" x2="20" y2="17" />
			<circle cx="9" cy="7" r="1.8" fill="currentColor" stroke="none" />
			<circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
			<circle cx="8" cy="17" r="1.8" fill="currentColor" stroke="none" />
		</svg>
	);
}

// 정렬 상태별 헤더 아이콘 (화살표: 오름=↑, 내림=↓, 미정렬=↕). currentColor 로 CSS 에서 색 제어.
function sortIconHtml(dir: string): string {
	const attrs = "class=\"rt-sort-icon\" viewBox=\"0 0 16 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.75\" stroke-linecap=\"round\" stroke-linejoin=\"round\"";
	if (dir === "asc") {
		return `<svg ${attrs}><path d="M8 13V3M4 7l4-4 4 4"/></svg>`;
	}
	if (dir === "desc") {
		return `<svg ${attrs}><path d="M8 3v10M4 9l4 4 4-4"/></svg>`;
	}
	return `<svg ${attrs}><path d="M8 3v10M5 6l3-3 3 3M5 10l3 3 3-3"/></svg>`;
}

interface FlashCell { row: any, field: string, variant: "up" | "down" }
interface RowUpdate { fields: Record<string, any>, flash: FlashCell[] }

// flash 클래스 제거 (setTimeout args 로 전달)
function removeFlash(el: HTMLElement, variant: string) {
	el.classList.remove("rt-cell-flash", `rt-cell-flash-${variant}`);
	el.style.removeProperty("--rt-flash-dur");
}

// 두 행의 값 diff: 변경된 필드 목록 + flash 대상. 숫자 증가=up(초록), 감소·비숫자=down(빨강). 배열/객체 필드는 스킵.
function arraysShallowEqual(a: any[], b: any[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

function diffRow(oldRow: any, newRow: any): RowUpdate {
	const fields: Record<string, any> = {};
	const flash: FlashCell[] = [];
	for (const field of Object.keys(newRow)) {
		const a = oldRow[field];
		const b = newRow[field];
		if (a === b) {
			continue;
		}
		// 배열: 얕은 비교로 변경 감지 → 값만 갱신(셀 재렌더/재draw). 플래시는 생략(sparkline 등).
		if (Array.isArray(a) || Array.isArray(b)) {
			if (Array.isArray(a) && Array.isArray(b) && arraysShallowEqual(a, b)) {
				continue;
			}
			fields[field] = b;
			continue;
		}
		// 그 외 객체는 비교/갱신 생략
		if (typeof a === "object" || typeof b === "object") {
			continue;
		}
		fields[field] = b;
		flash.push({ row: newRow, field, variant: (typeof a === "number" && typeof b === "number" && b > a) ? "up" : "down" });
	}
	return { fields, flash };
}

// 주어진 셀 목록에 flash 애니메이션 적용 (변경 셀만)
function flashCells(instance: any, cells: FlashCell[], indexField: string, duration: number) {
	const MAX = 300;
	cells.slice(0, MAX).forEach(({ row, field, variant }) => {
		const el: HTMLElement | undefined = instance.getRow(row?.[indexField])?.getCell(field)?.getElement?.();
		if (!el) {
			return;
		}
		el.style.setProperty("--rt-flash-dur", `${duration}ms`);
		el.classList.remove("rt-cell-flash", "rt-cell-flash-up", "rt-cell-flash-down");
		void el.offsetWidth; // reflow 로 애니메이션 재시작 보장
		el.classList.add("rt-cell-flash", `rt-cell-flash-${variant}`);
		setTimeout(removeFlash, duration, el, variant);
	});
}

// updateData(증분 갱신)는 재정렬을 트리거하지 않는다. 활성 정렬이 있으면 현재 sorter 로 재정렬을 재적용해
// 갱신된 값이 정렬 순서/현재 페이지에 반영되도록 한다. (정렬 없으면 no-op)
// setSort 는 현재 뷰포트 전체를 재렌더하므로, changedFields 로 "정렬 중인 필드가 실제 바뀐 경우"에만 재정렬한다.
// → 정렬과 무관한 필드만 갱신되면 순서가 바뀔 수 없으므로 재정렬(=전체 재렌더)을 생략한다.
function reapplyActiveSort(instance: any, changedFields?: Set<string>) {
	const sorters: any[] = instance.getSorters?.() ?? [];
	if (!sorters.length) {
		return;
	}
	const applied = sorters
		.map(s => ({ column: s.column?.getField?.() ?? s.field, dir: s.dir }))
		.filter(s => s.column);
	if (!applied.length) {
		return;
	}
	if (changedFields && !applied.some(s => changedFields.has(s.column))) {
		return;
	}
	instance.setSort(applied);
}

// ── 행번호(순번) ─────────────────────────────────────────
// 현재 정렬/필터/페이지 기준 "표시 순서" 전역 순번을 계산한다. getPosition(true) 는 페이지마다 1부터 시작하므로
// 현재 페이지 오프셋을 더한다.
function computeRowNumber(row: any, table: any): number {
	const posOnPage = row.getPosition?.(true) || 0;
	const page = table.getPage?.(); // number | false (페이지네이션 비활성 시 false)
	const pageSize = table.getPageSize?.(); // number | true
	if (!page || typeof pageSize !== "number") {
		return posOnPage;
	}
	return (page - 1) * pageSize + posOnPage;
}

// 재정렬/필터/페이지 변경 시 Tabulator 는 행 DOM 을 이동만 하고 rowHeader formatter 를 재실행하지 않아
// 순번이 이전 값(행을 따라다님)으로 남는다. 보이는 행들의 rowHeader 숫자를 현재 표시 순서에 맞게 다시 쓴다.
function refreshRowNumbers(instance: any) {
	// 렌더된 모든 행을 커버해야 순번 중복이 없다. 
	// active(전체 데이터)를 순회하면 데이터가 많을 때 심각한 성능 저하가 발생하므로,
	// 뷰포트에 보이는 visible 행을 기준으로 위/아래 버퍼에 렌더된 행까지만 탐색하여 갱신한다.
	const visibleRows: any[] = instance.getRows?.("visible") ?? [];
	if (!visibleRows.length) {
		return;
	}

	const updateRow = (row: any) => {
		const el: HTMLElement | null | undefined = row.getElement?.()?.querySelector?.(".tabulator-row-header");
		if (el) {
			el.textContent = String(computeRowNumber(row, instance));
		}
	};

	// 1. 현재 뷰포트에 보이는 행 갱신
	for (const row of visibleRows) {
		updateRow(row);
	}

	// 2. 상단 버퍼(화면 밖 렌더링 영역) 역방향 탐색
	let prev = visibleRows[0].getPrevRow?.();
	while (prev) {
		const e = prev.getElement?.();
		if (!e || !e.isConnected) {
			break; // 렌더되지 않은 행을 만나면 탐색 중단
		}
		updateRow(prev);
		prev = prev.getPrevRow?.();
	}

	// 3. 하단 버퍼(화면 밖 렌더링 영역) 정방향 탐색
	let next = visibleRows[visibleRows.length - 1].getNextRow?.();
	while (next) {
		const e = next.getElement?.();
		if (!e || !e.isConnected) {
			break; // 렌더되지 않은 행을 만나면 탐색 중단
		}
		updateRow(next);
		next = next.getNextRow?.();
	}
}

// ── 열 표시/숨김 애니메이션 (가로 FLIP) ────────────────────
// 열을 보이거나 숨기면 나머지 열들이 좌우로 밀린다. mutate 전후로 각 열(leaf)의 가로 위치(left)를 재서,
// 밀린 열들의 header + body 셀에 translateX(옛-새)를 걸었다가 0 으로 트랜지션해 부드럽게 슬라이드시킨다.
// (표시/숨김 대상 열 자체는 즉시 나타남/사라짐 — 나머지 열이 자리를 내주며 이동)
// 열 단위(field)로 매칭하므로 셀 엘리먼트가 재생성돼도 안전하고, 같은 열의 셀은 delta 가 동일하다.
function animateColumnFlip(instance: any, mutate: () => void, duration: number) {
	const leftOf = (c: any): number | undefined => {
		const el: HTMLElement | undefined = c.getElement?.();
		return el ? el.getBoundingClientRect().left : undefined;
	};
	// First: mutate 전 보이는 열들의 left 기록 (field 기준)
	const before = new Map<string, number>();
	for (const c of instance.getColumns?.(true) ?? []) {
		const field = c.getField?.();
		if (!field || !c.isVisible?.()) {
			continue;
		}
		const l = leftOf(c);
		if (l != null) {
			before.set(field, l);
		}
	}

	mutate(); // show/hideColumn (동기 재렌더)

	// Last + Invert: mutate 후 여전히 보이는 열들의 이동량(delta)만큼 즉시 옛 위치로
	const targets: HTMLElement[] = [];
	for (const c of instance.getColumns?.(true) ?? []) {
		const field = c.getField?.();
		if (!field || !c.isVisible?.()) {
			continue;
		}
		const first = before.get(field);
		if (first == null) {
			continue; // 새로 표시된 열 → 슬라이드 대상 아님(즉시 등장)
		}
		const el: HTMLElement | undefined = c.getElement?.();
		if (!el) {
			continue;
		}
		const dx = first - el.getBoundingClientRect().left;
		if (!dx) {
			continue; // frozen 등 위치 불변 열
		}
		// 해당 열의 header + 렌더된 body 셀 모두에 동일 delta 적용
		const cells: HTMLElement[] = [el];
		for (const cell of c.getCells?.() ?? []) {
			const ce: HTMLElement | undefined = cell.getElement?.();
			if (ce) {
				cells.push(ce);
			}
		}
		for (const t of cells) {
			t.style.transition = "none";
			t.style.transform = `translateX(${dx}px)`;
			targets.push(t);
		}
	}
	if (!targets.length) {
		return;
	}
	// Play: 다음 프레임에 원위치로 트랜지션
	requestAnimationFrame(() => {
		for (const t of targets) {
			t.style.transition = `transform ${duration}ms ease`;
			t.style.transform = "";
		}
		setTimeout(() => {
			for (const t of targets) {
				t.style.transition = "";
			}
		}, duration + 50);
	});
}

// ── 행 이동 애니메이션 (FLIP) ─────────────────────────────
// AG Grid animateRows 처럼, 재정렬로 행 위치가 바뀔 때 옛 위치→새 위치로 부드럽게 슬라이드시킨다.
// Tabulator 에 네이티브 옵션이 없어 FLIP(First-Last-Invert-Play) 기법으로 직접 구현.
// 가상 스크롤 특성상 "갱신 전·후 모두 뷰포트에 보이는 행"만 연출 가능(나머지는 그냥 나타남/사라짐).

// First: 갱신 직전, 현재 보이는 행들의 화면상 top 을 id(index) 별로 기록
function captureRowTops(instance: any): Map<any, number> {
	const map = new Map<any, number>();
	const rows: any[] = instance.getRows?.("visible") ?? [];
	for (const row of rows) {
		const el: HTMLElement | undefined = row.getElement?.();
		if (el) {
			map.set(row.getIndex?.(), el.getBoundingClientRect().top);
		}
	}
	return map;
}

// Last+Invert+Play: 재정렬 후 새 위치를 측정해, transform 으로 옛 위치에 두었다가 원위치로 트랜지션
function playRowFlip(instance: any, firstTops: Map<any, number>, duration: number) {
	const rows: any[] = instance.getRows?.("visible") ?? [];
	const moved: { el: HTMLElement, delta: number }[] = [];
	for (const row of rows) {
		const el: HTMLElement | undefined = row.getElement?.();
		if (!el) {
			continue;
		}
		const first = firstTops.get(row.getIndex?.());
		if (first == null) {
			continue; // 직전에 없던(새로 뷰포트에 들어온) 행 → 연출 생략
		}
		const delta = first - el.getBoundingClientRect().top;
		if (delta) {
			moved.push({ el, delta });
		}
	}
	if (!moved.length) {
		return;
	}
	// Invert: 즉시 옛 위치로 (transition 없이 순간 이동)
	for (const { el, delta } of moved) {
		el.style.transition = "none";
		el.style.transform = `translateY(${delta}px)`;
	}
	// Play: 다음 프레임에 원위치(transform 제거)로 트랜지션 → 슬라이드
	requestAnimationFrame(() => {
		for (const { el } of moved) {
			el.style.transition = `transform ${duration}ms ease`;
			el.style.transform = "";
		}
		// 트랜지션 종료 후 인라인 스타일 정리
		setTimeout(() => {
			for (const { el } of moved) {
				el.style.transition = "";
			}
		}, duration + 50);
	});
}

// 사용자 헤더 클릭 정렬용 애니메이션.
// 정렬로 뷰포트 상단 행이 통째로 바뀌면 "정렬 전·후 모두 보이는 행"이 없어 FLIP 슬라이드만으론 연출이 안 보인다.
// → 남아있는 행은 슬라이드(FLIP), 새로 뷰포트에 들어온 행은 페이드인(opacity+살짝 아래에서)으로 항상 연출되게 한다.
function playSortFlip(instance: any, firstTops: Map<any, number>, duration: number) {
	const rows: any[] = instance.getRows?.("visible") ?? [];
	const slide: { el: HTMLElement, delta: number }[] = [];
	const fade: HTMLElement[] = [];
	for (const row of rows) {
		const el: HTMLElement | undefined = row.getElement?.();
		if (!el) {
			continue;
		}
		const first = firstTops.get(row.getIndex?.());
		if (first == null) {
			fade.push(el); // 새로 들어온 행 → 페이드인
			continue;
		}
		const delta = first - el.getBoundingClientRect().top;
		if (delta) {
			slide.push({ el, delta });
		}
	}
	if (!slide.length && !fade.length) {
		return;
	}
	// Invert
	for (const { el, delta } of slide) {
		el.style.transition = "none";
		el.style.transform = `translateY(${delta}px)`;
	}
	for (const el of fade) {
		el.style.transition = "none";
		el.style.opacity = "0";
		el.style.transform = "translateY(6px)";
	}
	// Play
	requestAnimationFrame(() => {
		for (const { el } of slide) {
			el.style.transition = `transform ${duration}ms ease`;
			el.style.transform = "";
		}
		for (const el of fade) {
			el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
			el.style.opacity = "";
			el.style.transform = "";
		}
		setTimeout(() => {
			for (const { el } of slide) {
				el.style.transition = "";
			}
			for (const el of fade) {
				el.style.transition = "";
				el.style.opacity = "";
				el.style.transform = "";
			}
		}, duration + 50);
	});
}

// 헤더 클릭 시 정렬 3단계 순회 (오름 → 내림 → 해제). shift 키면 복수 정렬(additive).
function cycleColumnSort(column: any, additive: boolean) {
	const table = column.getTable();
	const field = column.getField();
	if (!field) {
		return;
	}
	const sorters: any[] = table.getSorters();
	const current = sorters.find(s => s.field === field);
	const nextDir = !current ? "asc" : current.dir === "asc" ? "desc" : null; // null = 해제
	if (additive) {
		const others = sorters.filter(s => s.field !== field).map(s => ({ column: s.field, dir: s.dir }));
		table.setSort(nextDir ? [...others, { column: field, dir: nextDir }] : others);
	}
	else if (nextDir) {
		table.setSort(field, nextDir);
	}
	else {
		table.clearSort();
	}
}

// 헤더 더블클릭 시 해당 컬럼 전체(현재 표시 셀 범위) 선택
function selectWholeColumn(column: any) {
	const table = column.getTable();
	const cells: any[] = column.getCells?.() ?? [];
	if (cells.length) {
		table.addRange(cells[0], cells[cells.length - 1]);
	}
}

// Tabulator 는 바닐라 JS 라이브러리이므로 기본 옵션은 기존 동작과 동일하게 유지합니다.
const DEFAULT_OPTIONS = {
	layout: "fitDataFill",
	resizableRowGuide: true,
	resizableColumnGuide: true,
	selectableRange: true,
	// 헤더 클릭으로 컬럼 전체가 선택되는 기본 동작을 끔 (대신 headerDblClick 으로 선택)
	selectableRangeColumns: false,
	selectableRangeRows: true,
	// 기본 range 생성 시 첫 셀로 포커스가 튀는 현상 방지 (실제 클릭 셀 포커스는 cellClick 이 처리)
	selectableRangeAutoFocus: false,
	// 네이티브 정렬은 아이콘 클릭 시에만. 헤더 본문 클릭 정렬은 headerClick 에서 수동 처리(더블클릭과 분리).
	headerSortClickElement: "icon",
	// 정렬 아이콘을 방향이 명확한 화살표로 교체 (테이블 옵션 - 컬럼/columnDefaults 아님)
	headerSortElement: (_column: any, dir: string) => sortIconHtml(dir),
	// editor 셀은 단일 클릭으로 편집되지 않고, 더블클릭으로만 편집 모드 진입.
	// (Enter 키 편집은 range 모듈이 활성 셀에 대해 기본 처리)
	editTriggerEvent: "dblclick",
	// 선택 범위(range) 기반 클립보드 복사/붙여넣기를 기본 활성화 (스프레드시트 방식)
	clipboard: true,
	clipboardCopyStyled: false,
	clipboardCopyConfig: { rowHeaders: false, columnHeaders: false },
	clipboardCopyRowRange: "range",
	clipboardPasteParser: "range",
	clipboardPasteAction: "range",
	pagination: "local",
	paginationSize: 6,
	paginationSizeSelector: [3, 6, 8, 10],
	movableColumns: true,
	paginationCounter: "rows",
	// rownum / getPosition 은 페이지마다 1부터 시작하므로, 현재 페이지 오프셋을 더해 전체 순번을 표시합니다.
	rowHeader: {
		formatter: (cell: any) => computeRowNumber(cell.getRow(), cell.getTable()),
		headerSort: false,
		hozAlign: "center",
		resizable: false,
		frozen: true,
		width: 60,
		minWidth: 40,
		widthGrow: 0,
	},
	columnDefaults: {
		resizable: true,
		// 정렬 3단계 토글: 오름차순 → 내림차순 → 정렬 끄기
		headerSortTristate: true,
		// 헤더 본문 클릭 → 정렬 순회(단, 더블클릭이면 취소). shift+클릭은 복수 정렬.
		headerClick: (e: any, column: any) => {
			// Alt + 클릭 → 컬럼 전체 선택
			if (e.altKey) {
				// range 모듈의 클릭 리셋 이후에 선택되도록 다음 틱으로 지연
				setTimeout(selectWholeColumn, 0, column);
				return;
			}
			// 정렬 아이콘 클릭은 네이티브 정렬에 맡김
			if (e.target?.closest?.(".tabulator-col-sorter")) {
				return;
			}
			const additive = !!e.shiftKey;
			// 딜레이 없이 즉시 정렬 실행
			cycleColumnSort(column, additive);
		},
	},
};

/**
 * @zh Tabulator(바닐라 JS)를 감싼 React 래퍼.
 *     - 최초 1회만 인스턴스를 생성하고, 데이터/컬럼 변경 시 replaceData / setColumns 로 증분 갱신합니다.
 *     - props 를 DOM 에 spread 하지 않아 불필요한 React 경고를 방지합니다.
 * @en A React wrapper around Tabulator (vanilla JS).
 *     - Builds the instance once, then updates data/columns incrementally via replaceData / setColumns.
 *     - Does not spread props onto the DOM, avoiding React attribute warnings.
 */
const ReactTabulator = forwardRef<GridApi, ReactTabulatorProps>((props, ref) => {
	const {
		idField,
		columns,
		data,
		options,
		events,
		className,
		style,
		onRef,
		headerToolbar,
		persistKey,
		rowNumber = true,
		flashOnChange = false,
		flashDuration = 800,
		coalesceUpdates = false,
		animateRows = true,
		animateRowsDuration = 250,
		animateCols = true,
		animateColsDuration = 250,
		autoSelectFirstCell = false,
	} = props;

	if (!idField) {
		throw new Error("[ReactTabulator] 'idField' prop은 필수입니다. 데이터의 고유 식별자 키를 명시해주세요.");
	}

	// headerToolbar 객체에서 값 파생 (미지정 시 header 미표시)
	const hasHeaderToolbar = headerToolbar != null;
	const columnSettingEnabled = headerToolbar?.columnSetting === true;
	const rowActionsEnabled = headerToolbar?.rowActions === true;
	const qfRaw = headerToolbar?.quickFilter;
	const quickFilter = qfRaw === undefined ? true : (typeof qfRaw === "boolean" ? qfRaw : true);
	const qfConfig = (typeof qfRaw === "object" && qfRaw) ? qfRaw : {};
	const quickFilterKeys = qfConfig.keys;
	const quickFilterPlaceholder = qfConfig.placeholder ?? "검색";
	const quickFilterDebounce = qfConfig.debounce ?? 250;
	const quickFilterExact = qfConfig.exact ?? false;

	const domRef = useRef<HTMLDivElement>(null);
	const instanceRef = useRef<any>(null);

	const gridApi: GridApi = {
		applyTransaction: (transaction: TransactionParams) => {
			const instance = instanceRef.current;
			const { add, addIndex = true, update, remove } = transaction;
			const res: { add: any[], update: any[], remove: any[] } = { add: [], update: [], remove: [] };
			if (!instance) return res;

			if (remove && remove.length > 0) {
				instance.deleteRow(remove);
				res.remove = remove;
			}
			if (add && add.length > 0) {
				const newRows = add.map((row: any) => ({ ...row, [idField]: row[idField] || `new_${Date.now()}_${Math.floor(Math.random()*1000)}`, _isNew: row._isNew ?? true }));
				instance.addData(newRows, addIndex);
				res.add = newRows;
			}
			if (update && update.length > 0) {
				instance.updateData(update);
				res.update = update;
			}
			return res;
		},
		getNewRowsData: () => {
			return instanceRef.current?.getData().filter((d: any) => d._isNew) || [];
		},
		getDeletedRowsData: () => {
			return instanceRef.current?.getData().filter((d: any) => d._isDeleted) || [];
		}
	};

	useImperativeHandle(ref, () => gridApi);

	const builtRef = useRef(false);
	const reactId = useId().replace(/:/g, "");

	// 열 설정 저장(persist) on/off — persistKey 가 있을 때 저장 플래그로 초기화 (내장 관리)
	const [persistEnabled, setPersistEnabled] = useState<boolean>(
		() => (persistKey ? localStorage.getItem(persistStorageKey(persistKey, "save-enabled")) === "1" : false),
	);
	// 내장 열 설정 UI 의 컬럼 목록 (group 은 parent/child 계층 구조)
	const [columnList, setColumnList] = useState<ColumnNode[]>([]);

	const [quickFilterValue, setQuickFilterValue] = useState("");
	const quickFilterValueRef = useRef("");
	const quickFilterKeysRef = useRef(quickFilterKeys);
	quickFilterKeysRef.current = quickFilterKeys;
	const quickFilterExactRef = useRef(quickFilterExact);
	quickFilterExactRef.current = quickFilterExact;
	// Fuse 검색 대상: table.getData()(accessor transform 으로 클론됨) 대신 원본 data prop 사용.
	// filter 콜백이 받는 row.getData()(원본)와 참조가 일치해야 매칭됨.
	const dataRef = useRef(data);
	dataRef.current = data;
	// flashOnChange 관련 ref
	const flashOnChangeRef = useRef(flashOnChange);
	flashOnChangeRef.current = flashOnChange;
	const flashDurationRef = useRef(flashDuration);
	flashDurationRef.current = flashDuration;
	const indexFieldRef = useRef<string>(idField);
	indexFieldRef.current = idField;
	// 직전(마지막으로 렌더된) 데이터 (변경 셀 diff 용)
	const prevDataRef = useRef<any[]>(data ?? []);
	// rAF coalescing 관련 ref
	const coalesceRef = useRef(coalesceUpdates);
	coalesceRef.current = coalesceUpdates;
	const rafIdRef = useRef<number | null>(null);
	const pendingDataRef = useRef<any[] | null>(null);
	// 행 이동 애니메이션(FLIP) 관련 ref
	const animateRowsRef = useRef(animateRows);
	animateRowsRef.current = animateRows;
	const animateRowsDurationRef = useRef(animateRowsDuration);
	animateRowsDurationRef.current = animateRowsDuration;
	const animateColsRef = useRef(animateCols);
	animateColsRef.current = animateCols;
	const animateColsDurationRef = useRef(animateColsDuration);
	animateColsDurationRef.current = animateColsDuration;
	// 프로그램적 재정렬(updateData 경로) 중임을 표시 → 정렬 이벤트 기반 FLIP 과 이중 실행 방지
	const programmaticSortRef = useRef(false);
	// 사용자 헤더 클릭 정렬 시 dataSorting 에서 캡처한 First 위치(renderComplete 에서 재생)
	const pendingFlipTopsRef = useRef<Map<any, number> | null>(null);
	// FLIP 쿨다운: 마지막 슬라이드 시작 시각(performance.now). 고빈도 갱신 시 애니메이션 빈도 제한용.
	const lastFlipAtRef = useRef(0);
	// Quick Filter 검색용 캐시 (Fuse 인스턴스 및 파싱된 텍스트 재사용)
	const quickFilterCacheRef = useRef<{ data: any[], keys: string[], searchRows: any[], fuse: Fuse<any> | null }>({
		data: [],
		keys: [],
		searchRows: [],
		fuse: null,
	});

	// 전체 row 데이터를 Fuse.js 로 fuzzy 검색하여 매칭되는 행만 표시
	const applyQuickFilter = (term: string) => {
		const inst = instanceRef.current;
		if (!inst || !builtRef.current) {
			return;
		}
		const value = term.trim();
		if (!value) {
			inst.clearFilter(); // quick filter 해제
			return;
		}
		const rows: any[] = dataRef.current ?? []; // 원본 전체 데이터 (filter 콜백의 row.getData()와 동일 참조)
		const allFieldKeys = inst.getColumns(true).filter((col: any) => col.getField()).map((col: any) => col.getField());
		const keys = quickFilterKeysRef.current ?? allFieldKeys;

		const cache = quickFilterCacheRef.current;
		let { searchRows, fuse } = cache;
		const keysChanged = cache.keys.length !== keys.length || cache.keys.some((k, i) => k !== keys[i]);

		// 데이터나 키가 변경된 경우에만 파싱 및 인덱싱 재수행
		if (cache.data !== rows || keysChanged) {
			// 컬럼 키를 한 번만 split 하여 캐싱
			const parsedKeys = keys.map((k: string) => k.split("."));
			const getByPath = (obj: any, pathParts: string[]) => pathParts.reduce((o, p) => (o == null ? o : o[p]), obj);
			
			// 행의 모든 컬럼 값을 하나의 문자열로 합쳐 "행 전체 컬럼" 기준으로 검색 (AG Grid quick filter 방식)
			searchRows = rows.map(row => ({
				row,
				text: parsedKeys.map((pathParts: string[]) => {
					const v = getByPath(row, pathParts);
					return v == null ? "" : String(v);
				}).join(" "),
			}));
			
			// fuzzy 검색용 Fuse 인스턴스 재생성
			fuse = new Fuse(searchRows, { keys: ["text"], threshold: 0.3, ignoreLocation: true });
			quickFilterCacheRef.current = { data: rows, keys, searchRows, fuse };
		}

		let matched: Set<any>;
		if (quickFilterExactRef.current) {
			// 완전 부분일치: 대소문자 무시 substring 검색
			const needle = value.toLowerCase();
			matched = new Set(searchRows.filter(sr => sr.text.toLowerCase().includes(needle)).map(sr => sr.row));
		}
		else {
			// fuzzy 검색
			matched = new Set(fuse!.search(value).map(res => res.item.row));
		}
		inst.setFilter((rowData: any) => matched.has(rowData));
	};

	// 실제 검색 실행은 debounce (연속 입력 시 마지막 입력 기준 1회만 실행)
	const { run: runQuickFilter } = useDebounceFn(
		(value: string) => applyQuickFilter(value),
		{ wait: quickFilterDebounce },
	);

	const onQuickFilterChange = (value: string) => {
		setQuickFilterValue(value); // 입력 즉시 UI 반영
		quickFilterValueRef.current = value;
		runQuickFilter(value); // 검색은 debounce
	};

	// ── 내장 열 설정 UI 로직 ──
	// 현재 인스턴스의 컬럼 구조/가시성을 UI 상태에 반영. group 은 parent/child 계층으로 구성.
	const refreshColumnList = () => {
		const inst = instanceRef.current;
		if (!inst) {
			return;
		}
		// 컬럼 구조를 재귀적으로 노드 트리로 변환 (group 중첩 유지)
		const buildNode = (col: any): ColumnNode | null => {
			const subs = col.getSubColumns?.() ?? [];
			if (subs.length) {
				const children = subs.map(buildNode).filter(Boolean) as ColumnNode[];
				return children.length ? { group: true, title: col.getDefinition().title ?? "", children } : null;
			}
			if (col.getField()) {
				return { field: col.getField(), title: col.getDefinition().title ?? col.getField(), visible: col.isVisible() };
			}
			return null;
		};
		// getColumns(true) = top-level 구조(structured, group 은 단일). 인자 없으면 전체 leaf flat 이라 계층이 사라짐.
		const nodes = inst.getColumns(true).map(buildNode).filter(Boolean) as ColumnNode[];
		setColumnList(nodes);
	};

	// 컬럼 표시/숨김 토글 (persistence 는 columnVisibilityChanged 로 자동 저장됨)
	const toggleColumnVisible = (field: string, checked: boolean) => {
		const inst = instanceRef.current;
		if (!inst) {
			return;
		}
		const mutate = () => (checked ? inst.showColumn(field) : inst.hideColumn(field));
		if (animateColsRef.current) {
			animateColumnFlip(inst, mutate, animateColsDurationRef.current);
		}
		else {
			mutate();
		}
		refreshColumnList();
	};

	// group 하위 컬럼 일괄 표시/숨김
	const toggleColumnsVisible = (fields: string[], checked: boolean) => {
		const inst = instanceRef.current;
		if (!inst) {
			return;
		}
		const mutate = () => fields.forEach(field => (checked ? inst.showColumn(field) : inst.hideColumn(field)));
		if (animateColsRef.current) {
			animateColumnFlip(inst, mutate, animateColsDurationRef.current);
		}
		else {
			mutate();
		}
		refreshColumnList();
	};

	// 열 설정 저장 on/off (플래그 저장 → persistEnabled 상태로 persistence 게이트)
	const toggleSaveColumns = (checked: boolean) => {
		setPersistEnabled(checked);
		if (persistKey) {
			localStorage.setItem(persistStorageKey(persistKey, "save-enabled"), checked ? "1" : "0");
		}
	};

	// 열 설정 UI 노드를 재귀 렌더 (group 은 깊이에 따라 들여쓰기 + parent 체크박스)
	const renderColumnNode = (node: ColumnNode, key: string, depth: number) => {
		const indent = { paddingLeft: depth * 16 };
		if ("group" in node) {
			const leaves = gatherLeaves(node);
			const allVisible = leaves.every(c => c.visible);
			const someVisible = leaves.some(c => c.visible);
			return (
				<div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
					<div style={indent}>
						<Checkbox
							checked={allVisible}
							indeterminate={someVisible && !allVisible}
							onChange={checked => toggleColumnsVisible(leaves.map(c => c.field), checked)}
						>
							<strong>{node.title}</strong>
						</Checkbox>
					</div>
					{node.children.map((child, i) => renderColumnNode(child, `${key}-${i}`, depth + 1))}
				</div>
			);
		}
		return (
			<div key={key} style={indent}>
				<Checkbox checked={node.visible} onChange={checked => toggleColumnVisible(node.field, checked)}>
					{node.title}
				</Checkbox>
			</div>
		);
	};

	// 이벤트 핸들러에서 최신 값을 참조하기 위한 ref
	const persistKeyRef = useRef(persistKey);
	persistKeyRef.current = persistKey;
	const persistEnabledRef = useRef(persistEnabled);
	persistEnabledRef.current = persistEnabled;

	// 최초 1회: Tabulator 인스턴스 생성
	useEffect(() => {
		let destroyed = false;

		const build = async () => {
			const el = domRef.current;
			if (!el) {
				return;
			}
			const propOptions = await propsToOptions(props);
			const persistOptions = persistKey
				? {
					persistenceID: persistKey,
					persistence: {
						columns: ["visible", "width"],
						sort: true,
						group: true,
						page: true,
						headerFilter: true,
					},
					persistenceReaderFunc: (id: string, type: string) => {
						if (!persistEnabledRef.current) {
							return false;
						}
						const raw = localStorage.getItem(persistStorageKey(id, type));
						if (!raw) {
							return false;
						}
						try {
							return JSON.parse(raw);
						}
						catch {
							return false;
						}
					},
					persistenceWriterFunc: (id: string, type: string, data: any) => {
						if (!persistEnabledRef.current) {
							return;
						}
						localStorage.setItem(persistStorageKey(id, type), JSON.stringify(data));
					},
				}
				: {};
				
			const customRowFormatter = propOptions?.rowFormatter ?? options?.rowFormatter;
			const enhancedRowFormatter = (row: any) => {
				const data = row.getData();
				setTimeout(() => {
					const el: HTMLElement | undefined = row.getElement?.();
					if (el) {
						el.classList.toggle("rt-row-new", !!data._isNew);
						el.classList.toggle("rt-row-deleted", !!data._isDeleted);
					}
				}, 0);
				customRowFormatter?.(row);
			};

			const instance = new Tabulator(el, {
				columns,
				data: data ?? [],
				index: idField,
				...DEFAULT_OPTIONS,
				// rowNumber=false 이면 행번호 컬럼 숨김 (DEFAULT_OPTIONS.rowHeader 덮어씀)
				...(rowNumber ? {} : { rowHeader: false }),
				...persistOptions,
				...propOptions,
				...options,
				rowFormatter: enhancedRowFormatter,
			});
			


			// StrictMode 등으로 마운트 도중 언마운트된 경우 방금 만든 인스턴스를 정리합니다.
			if (destroyed) {
				try {
					instance.destroy();
				}
				catch {}
				return;
			}

			instance.on("tableBuilt", () => {
				builtRef.current = true;
			});
			// 재렌더로 파기된 reactFormatter 셀의 React root 를 정리(unmount) → DOM 노드/이벤트 리스너 누수 방지.
			// 셀 엘리먼트가 재생성되는 경우에도 renderComplete 마다 확실히 회수한다.
			// 사용자 헤더 클릭 정렬: 정렬 직전(행이 아직 옛 위치)에 First 위치를 캡처.
			// 프로그램적 정렬(updateData 경로)은 수동 FLIP 이 처리하므로 여기서는 건너뛴다(이중 방지).
			instance.on("dataSorting", () => {
				if (programmaticSortRef.current || !animateRowsRef.current) {
					pendingFlipTopsRef.current = null;
					return;
				}
				// 쿨다운: 직전 슬라이드가 끝난 뒤에만 새 슬라이드 시작
				const now = performance.now();
				if (now - lastFlipAtRef.current < animateRowsDurationRef.current) {
					pendingFlipTopsRef.current = null;
					return;
				}
				lastFlipAtRef.current = now;
				pendingFlipTopsRef.current = captureRowTops(instance);
			});
			// 최초 렌더링 시 자동 선택(포커스) 해제용 플래그
			let initialClearDone = false;

			// 렌더 완료 후: (1) 파기된 reactFormatter root 정리, (2) rowHeader 순번 재매김,
			//   (3) 사용자 정렬로 캡처해 둔 First 가 있으면 새 위치로 FLIP 재생(재배치 끝난 뒤라 정확).
			//   (4) 최초 렌더링 시 첫 셀 자동 선택 방지 옵션 처리.
			instance.on("renderComplete", () => {
				sweepReactRoots();
				refreshRowNumbers(instance);
				if (pendingFlipTopsRef.current) {
					playSortFlip(instance, pendingFlipTopsRef.current, animateRowsDurationRef.current);
					pendingFlipTopsRef.current = null;
				}
				if (!initialClearDone && !autoSelectFirstCell) {
					initialClearDone = true;
					// UI 업데이트 이후에 range가 생성될 수 있으므로 setTimeout으로 지연 해제
					setTimeout(() => {
						try { (instance as any).clearRange?.(); } catch {}
					}, 0);
				}
			});
			// editor 로 값이 수정된 셀을 표시합니다. 초기값과 비교해 변경 시 클래스 부여, 되돌리면 제거.
			instance.on("cellEdited", (cell: any) => {
				const changed = cell.getValue() !== cell.getInitialValue();
				cell.getElement()?.classList.toggle("tabulator-cell-edited", changed);
			});
			// 컬럼 가시성/폭/순서 저장·복원은 내장 persistence(persistOptions)가 처리합니다.
			if (events) {
				Object.entries(events).forEach(([eventName, handler]) => {
					instance.on(eventName as any, handler as any);
				});
			}
			instanceRef.current = instance;
			if (onRef) {
				onRef({ current: gridApi });
			}
		};

		build();

		return () => {
			destroyed = true;
			builtRef.current = false;
			if (instanceRef.current) {
				try {
					instanceRef.current.destroy();
				}
				catch {}
				instanceRef.current = null;
			}
		};
		// 최초 1회만 실행 (데이터/컬럼 변경은 아래 effect 에서 증분 처리)
		// eslint-disable-next-line react/exhaustive-deps
	}, []);

	// 데이터 변경 처리: 행 집합/순서가 같으면 updateData(변경 필드만) 로 증분 갱신,
	// 다르면(추가/삭제/재정렬) replaceData 로 전체 교체. → 안 바뀐 셀 재렌더/깜박임 방지.
	// 최신 버전을 ref 로 보관해 rAF flush 시 stale 클로저를 방지한다.
	const runDataUpdate = (next: any[]) => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current) {
			return;
		}
		const idxF = indexFieldRef.current;
		const prev = prevDataRef.current;

		// FLIP 쿨다운 가드: 직전 슬라이드가 끝난 뒤(>= duration)에만 새 슬라이드를 시작한다.
		// 고빈도(주기 < duration) 갱신에서 애니메이션이 끝까지 재생되도록 하고, reflow 를 duration 당 1회로 제한.
		// 쿨다운 중에도 데이터는 그대로 갱신되며 이 틱의 슬라이드만 생략(→ null 반환).
		const beginFlip = (): Map<any, number> | null => {
			if (!animateRowsRef.current) {
				return null;
			}
			const now = performance.now();
			if (now - lastFlipAtRef.current < animateRowsDurationRef.current) {
				return null; // 쿨다운 중 → 이번 틱 슬라이드 생략
			}
			lastFlipAtRef.current = now;
			return captureRowTops(instance);
		};

		let sameRowSet = prev.length > 0 && prev.length === next.length;
		if (sameRowSet) {
			for (let i = 0; i < prev.length; i++) {
				if (prev[i]?.[idxF] !== next[i]?.[idxF]) {
					sameRowSet = false;
					break;
				}
			}
		}

		const afterUpdate = (flash: FlashCell[]) => {
			if (quickFilterValueRef.current) {
				applyQuickFilter(quickFilterValueRef.current);
			}
			if (flashOnChangeRef.current && flash.length) {
				flashCells(instance, flash, idxF, flashDurationRef.current);
			}
			// updateData 등 부분 갱신 시 renderComplete 이벤트가 발생하지 않을 수 있으므로,
			// 갱신 직후 수동으로 끊긴 DOM(React Root)을 강제 정리해 메모리 누수를 막는다.
			sweepReactRoots();
		};

		if (sameRowSet) {
			// 증분 갱신: 변경된 필드만 updateData → 나머지 셀(코드 컬럼 등)은 재렌더되지 않음
			const updates: any[] = [];
			const flash: FlashCell[] = [];
			const changedFields = new Set<string>();
			for (let i = 0; i < next.length; i++) {
				const row = next[i];
				const old = prev[i];
				if (!old) {
					continue;
				}
				const { fields, flash: rowFlash } = diffRow(old, row);
				const keys = Object.keys(fields);
				if (keys.length) {
					updates.push({ [idxF]: row[idxF], ...fields });
					flash.push(...rowFlash);
					keys.forEach(k => changedFields.add(k));
				}
			}
			if (updates.length) {
				// 변경 행들을 배열 하나로 묶어 updateData 1회만 호출 (행별 병렬 호출 아님 → 재렌더 1패스).
				// FLIP: 재정렬로 위치가 바뀌기 전(현재)의 행 위치를 먼저 기록. (쿨다운 중이면 null)
				const firstTops = beginFlip();
				instance.updateData(updates).then(() => {
					// 갱신된 값이 정렬 순서/현재 페이지에 반영되도록 활성 정렬을 재적용한다.
					// (정렬 중인 필드가 바뀐 경우에만 → 불필요한 전체 재렌더 방지. 재정렬은 flash 보다 먼저.)
					// 프로그램적 정렬 플래그 → dataSorting 이벤트 기반 FLIP 이 이중 실행되지 않게 함(수동 FLIP 이 처리).
					programmaticSortRef.current = true;
					reapplyActiveSort(instance, changedFields);
					programmaticSortRef.current = false;
					// 재정렬 후 새 위치로 슬라이드 애니메이션 (flash 보다 먼저 적용)
					if (firstTops) {
						playRowFlip(instance, firstTops, animateRowsDurationRef.current);
					}
					afterUpdate(flash);
				}).catch(() => {});
			}
		}
		else {
			// 행 집합/순서 변경 → 전체 교체 후 diff 로 flash
			const flash: FlashCell[] = [];
			if (flashOnChangeRef.current) {
				const prevMap = new Map(prev.map(r => [r?.[idxF], r]));
				for (const row of next) {
					const old = prevMap.get(row?.[idxF]);
					if (old) {
						flash.push(...diffRow(old, row).flash);
					}
				}
			}
			// FLIP: 교체 전(현재)의 행 위치 기록 → 교체 후 슬라이드 (쿨다운 중이면 null)
			// replaceData 는 내부적으로 정렬을 재적용하며 dataSorting 을 발생시키므로, 이중 FLIP 방지 플래그를 건다.
			const firstTops = beginFlip();
			programmaticSortRef.current = true;
			instance.replaceData(next).then(() => {
				programmaticSortRef.current = false;
				if (firstTops) {
					playRowFlip(instance, firstTops, animateRowsDurationRef.current);
				}
				afterUpdate(flash);
			}).catch(() => {
				programmaticSortRef.current = false;
			});
		}
		prevDataRef.current = next;
	};
	const runDataUpdateRef = useRef(runDataUpdate);
	runDataUpdateRef.current = runDataUpdate;

	// data prop 변경을 감지해 갱신을 실행. coalesceUpdates 면 rAF 로 프레임당 1회로 합친다.
	useEffect(() => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current) {
			return;
		}
		const next = data ?? [];
		if (!coalesceRef.current) {
			runDataUpdateRef.current(next); // 즉시(기존 동작)
			return;
		}
		// rAF coalescing: 프레임 내 다중 변경을 최신값 1건으로 합쳐 프레임당 최대 1회만 갱신/재렌더.
		// pendingDataRef 에 최신값을 계속 덮어쓰고, 예약된 rAF 가 없을 때만 1회 예약한다.
		pendingDataRef.current = next;
		rafIdRef.current ??= requestAnimationFrame(() => {
			rafIdRef.current = null;
			const latest = pendingDataRef.current ?? [];
			pendingDataRef.current = null;
			runDataUpdateRef.current(latest);
		});
		// applyQuickFilter/runDataUpdate 는 ref 기반이라 의존성에 포함하지 않습니다.
	}, [data]);

	// 언마운트 시 대기 중인 rAF 취소 (destroy 후 flush 방지)
	useEffect(() => () => {
		if (rafIdRef.current != null) {
			cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}
	}, []);

	// 컬럼 변경: setColumns 로 갱신 (columns 는 호출부에서 useMemo 로 안정화 권장)
	useEffect(() => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current) {
			return;
		}
		instance.setColumns(columns ?? []);
	}, [columns]);

	// persistEnabled 토글 반영: off → 저장값 제거 (on 은 이후 컬럼 변경 시 writer 가 저장)
	useEffect(() => {
		if (!persistKey || !builtRef.current) {
			return;
		}
		if (!persistEnabled) {
			PERSIST_TYPES.forEach(type => localStorage.removeItem(persistStorageKey(persistKey, type)));
		}
	}, [persistEnabled, persistKey]);

	const showHeader = hasHeaderToolbar && (quickFilter || columnSettingEnabled || rowActionsEnabled);

	const handleAddRow = (rowsToAdd?: any[]) => {
		// 내부 툴바 액션도 applyTransaction 을 통하도록 단일화
		const add = rowsToAdd && rowsToAdd.length > 0 ? rowsToAdd : [{}];
		gridApi.applyTransaction({ add });
	};

	const handleDeleteRow = (rowsToDelete?: any[]) => {
		const instance = instanceRef.current;
		if (!instance) return;
		
		let targetRows = rowsToDelete;
		if (!targetRows || targetRows.length === 0) {
			targetRows = instance.getSelectedRows() || [];
			if (targetRows!.length === 0 && instance.modules.selectRange) {
				const ranges = instance.modules.selectRange.getRanges?.() || [];
				const rowSet = new Set();
				ranges.forEach((r: any) => {
					const rangeRows = r.getRows?.() || [];
					rangeRows.forEach((row: any) => rowSet.add(row));
				});
				targetRows = Array.from(rowSet);
			}
		}

		if (!targetRows || targetRows.length === 0) return;

		const remove: any[] = [];
		const update: any[] = [];

		targetRows!.forEach((row: any) => {
			const rowComp = typeof row.getData === 'function' ? row : instance.getRow(row[idField] || row);
			if (!rowComp) return;
			const data = rowComp.getData();
			if (data._isNew) remove.push(rowComp);
			else update.push({ [idField]: data[idField], _isDeleted: !data._isDeleted });
		});

		// 내부 툴바 액션도 applyTransaction 을 통하도록 단일화
		gridApi.applyTransaction({ remove, update });
		instance.deselectRow();
	};

	return (
		// header + table 을 하나의 컨테이너로 묶어 단일 컴포넌트처럼 보이게 함 (antd 테마 border/radius 는 컨테이너에 적용)
		// flex 세로 배치 + height:100% 로 부모의 남는 영역을 채움 (consumer 가 style 로 override 가능)
		<div className={className} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
			{/* 상단 header 툴바: 왼쪽 quick filter, 오른쪽 열 설정(내장) */}
			{showHeader && (
				<div
					className="react-tabulator-header"
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 8,
					}}
				>
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						{quickFilter && (
							<Input
								size="small"
								allowClear
								prefix={<SearchIcon />}
								placeholder={quickFilterPlaceholder}
								value={quickFilterValue}
								onChange={onQuickFilterChange}
								style={{ width: 220 }}
							/>
						)}
					</div>
					<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
						{rowActionsEnabled && (
							<>
								<Button 
									size="small" 
									icon={<PlusIcon />} 
									onClick={(e) => { e.stopPropagation(); handleAddRow(); }} 
									onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
								>
									추가
								</Button>
								<Button 
									size="small" 
									icon={<MinusIcon />} 
									onClick={(e) => { e.stopPropagation(); handleDeleteRow(); }} 
									onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
								>
									삭제
								</Button>
							</>
						)}
						{columnSettingEnabled && (
							<Popover
								placement="bottomRight"
								title="열 설정"
								onOpenChange={open => open && refreshColumnList()}
								content={(
									<div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
										{persistKey && (
											<>
												<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
													<span>열 설정 저장</span>
													<Switch checked={persistEnabled} onChange={toggleSaveColumns} />
												</div>
												<Divider />
											</>
										)}
										<div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflow: "auto" }}>
											{columnList.map((node, idx) => renderColumnNode(node, `n-${idx}`, 0))}
										</div>
									</div>
								)}
							>
								<Button size="small" icon={<SettingIcon />}>열 설정</Button>
							</Popover>
						)}
					</div>
				</div>
			)}
			<div ref={domRef} id={reactId} style={{ flex: 1, minHeight: 0 }} />
		</div>
	);
});

export default ReactTabulator;
