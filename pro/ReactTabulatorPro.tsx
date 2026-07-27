// SPDX-License-Identifier: PolyForm-Small-Business-1.0.0 OR LicenseRef-Commercial
import type { ColumnDefinition, ReactTabulatorCoreProps } from "../core/ReactTabulator";
import type { FlashCell } from "./flash";
import type { ReactTabulatorLangTexts } from "./i18n";

import { useDebounceFn } from "ahooks";
import Fuse from "fuse.js";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { mergeLangs } from "../core/i18n";
import ReactTabulatorCore from "../core/ReactTabulator";
import { animateColumnFlip, captureRowTops, playRowFlip, playSortFlip } from "./animations";
import { computeFlashCells, flashCells } from "./flash";
import { PRO_LANGS, resolveWrapperTexts } from "./i18n";
import { Button, Checkbox, Divider, Input, Popover, Switch } from "./primitives";
import { createSetFilterPopup, getByPath, SET_FILTER_ICON_HTML, setFilterValueKey } from "./set-filter";

export interface TransactionParams {
	add?: any[]
	addIndex?: number | boolean
	update?: any[]
	remove?: any[]
}

export interface GridApi {
	applyTransaction: (transaction: TransactionParams) => { add: any[], update: any[], remove: any[] }
	getNewRowsData: () => any[]
	getDeletedRowsData: () => any[]
}

/** 툴바 항목 공통 설정. 각 항목은 이 객체(세부 옵션 포함)로 지정한다 — 버튼별 확장 옵션은 각 설정 인터페이스에 추가. */
export interface ToolbarItemConfig {
	/** 항목 표시 여부. 설정 객체를 지정한 경우 기본 true */
	enabled?: boolean
}

/** quick filter 세부 설정 */
export interface QuickFilterConfig extends ToolbarItemConfig {
	/** 검색 대상 필드. 미지정 시 field 를 가진 모든 leaf 컬럼 */
	keys?: string[]
	/** placeholder 텍스트. 미지정 시 locale 사전의 문자열(기본 영어 "Search") */
	placeholder?: string
	/** 검색 실행 debounce (ms, 기본 250) */
	debounce?: number
	/** true 이면 fuzzy 대신 대소문자 무시 완전 부분일치(substring) 검색 (기본 false) */
	exact?: boolean
}

/** 열 설정 버튼 세부 설정 */
export interface ColumnSettingButtonConfig extends ToolbarItemConfig {
	/** 버튼/팝오버 제목 텍스트. 미지정 시 locale 사전의 문자열 */
	label?: string
}

/** 행 추가 버튼 세부 설정 */
export interface AddButtonConfig extends ToolbarItemConfig {
	/** 버튼 텍스트. 미지정 시 locale 사전의 문자열 */
	label?: string
}

/** 행 삭제 버튼 세부 설정 */
export interface DeleteButtonConfig extends ToolbarItemConfig {
	/** 버튼 텍스트. 미지정 시 locale 사전의 문자열 */
	label?: string
}

/** 초기화 버튼 세부 설정 */
export interface ResetButtonConfig extends ToolbarItemConfig {
	/** 버튼 텍스트. 미지정 시 locale 사전의 문자열 */
	label?: string
}

/** 상단 header 툴바 설정. 항목별로 `{ enabled, ...옵션 }` 설정 객체를 지정한다. */
export interface HeaderToolbarConfig {
	/**
	 * @zh quick filter 입력창(header 왼쪽). 미지정 시 표시(enabled: true 취급).
	 */
	quickFilter?: QuickFilterConfig
	/**
	 * @zh 내장 열 설정 UI(열 표시/숨김 + 저장 스위치). header 오른쪽에 렌더링됩니다.
	 *     저장 스위치는 persistKey 가 지정된 경우 나타납니다. 미지정 시 미표시.
	 */
	columnSettingButton?: ColumnSettingButtonConfig
	/**
	 * @zh 행 추가(Plus) 버튼. 신규 행은 옅은 파란색으로 표시되며 `_isNew` 플래그로 관리됩니다. 미지정 시 미표시.
	 */
	addButton?: AddButtonConfig
	/**
	 * @zh 행 삭제(Minus) 버튼. 기존 행은 취소선 표시(soft delete, `_isDeleted` 토글), 신규 행은 완전 삭제. 미지정 시 미표시.
	 */
	deleteButton?: DeleteButtonConfig
	/**
	 * @zh 초기화 버튼. 클릭 시 확인 후 모든 로컬 변경(셀 수정·행 추가·삭제 표시)을 버리고
	 *     초기(init) 데이터로 원복하며, 정렬/quick filter/페이지 위치도 초기화합니다. 미지정 시 미표시.
	 *     활성화 시 데이터 수신 시점마다 원복용 스냅샷(클론)을 유지하므로 초대량·고빈도 갱신 화면에서는 비용을 고려하세요.
	 */
	resetButton?: ResetButtonConfig
}

/** 툴바 항목 입력(설정 객체/미지정)을 { enabled, config } 로 정규화. 설정 객체가 있으면 enabled 기본 true. */
function normalizeToolbarItem<T extends ToolbarItemConfig>(
	input: T | undefined,
	defaultEnabled: boolean,
): { enabled: boolean, config: T } {
	if (input === undefined) {
		return { enabled: defaultEnabled, config: {} as T };
	}
	return { enabled: input.enabled ?? true, config: input };
}

/** 상태바(range 집계) 설정 */
export interface StatusBarConfig extends ToolbarItemConfig {
}

// 상태바 range 집계 결과
interface RangeStats {
	/** 값이 있는 선택 셀 수 */
	count: number
	/** 숫자 셀 수 (합계/평균/최소/최대의 모수) */
	numeric: number
	sum: number
	avg: number
	min: number
	max: number
}

// 상태바 숫자 표기 (소수 2자리까지, 천단위 구분)
const statusNumberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

// 현재 range 선택 영역의 집계 계산. RowComponent 프록시 생성 비용을 피하기 위해 내부 Range 객체를 사용.
function computeRangeStats(instance: any): RangeStats | null {
	const ranges: any[] = instance.getRanges?.() ?? [];
	if (!ranges.length) {
		return null;
	}
	let count = 0;
	let numeric = 0;
	let sum = 0;
	let min = Infinity;
	let max = -Infinity;
	for (const rc of ranges) {
		const range = rc?._range ?? rc;
		const rows: any[] = range.getRows?.() ?? [];
		const fields: string[] = (range.getColumns?.() ?? []).map((c: any) => c.getField?.()).filter(Boolean);
		for (const row of rows) {
			const data = row.getData?.() ?? {};
			for (const field of fields) {
				const v = getByPath(data, field);
				if (v == null || v === "") {
					continue;
				}
				count++;
				if (typeof v === "number" && Number.isFinite(v)) {
					numeric++;
					sum += v;
					if (v < min) {
						min = v;
					}
					if (v > max) {
						max = v;
					}
				}
			}
		}
	}
	if (count <= 1) {
		return null; // 단일 셀 선택은 표시 생략 (엑셀과 동일한 UX)
	}
	return { count, numeric, sum, avg: numeric ? sum / numeric : 0, min, max };
}

/** 프로 확장 컬럼 정의 — 코어 ColumnDefinition + 프로 전용 컬럼 옵션 */
export interface ProColumnDefinition extends ColumnDefinition {
	/**
	 * @zh 엑셀식 고유값 체크박스 필터(Set Filter). true 면 헤더에 깔때기 아이콘이 표시되고,
	 *     클릭 시 해당 컬럼 고유값 목록(검색 + 전체 선택)으로 행을 필터링할 수 있습니다.
	 *     quick filter 와 AND 로 결합되며, 초기화 버튼으로 함께 해제됩니다.
	 */
	setFilter?: boolean
	columns?: ProColumnDefinition[]
}

export interface ReactTabulatorProps extends Omit<ReactTabulatorCoreProps, "columns" | "onRef" | "onInstance" | "onBeforeDataUpdate" | "onAfterDataUpdate"> {
	columns?: ProColumnDefinition[]
	/** 엄격하게 제어된 GridApi 객체를 전달 (또는 ref 훅 사용 권장) */
	onRef?: (ref: React.RefObject<GridApi> | { current: GridApi }) => void
	/**
	 * @zh 상단 header 툴바 설정. 지정하면 테이블 위에 header 를 렌더링하여 왼쪽에 quick filter,
	 *     오른쪽에 행 추가/삭제(addButton/deleteButton)·초기화(resetButton)·열 설정(columnSettingButton)을 배치합니다. 미지정 시 미표시.
	 */
	headerToolbar?: HeaderToolbarConfig
	/**
	 * @zh 하단 상태바(range 집계). range 로 셀을 선택하면 개수/합계/평균/최소/최대를 표시합니다
	 *     (AG Grid Status Bar 대응, 숫자 통계는 숫자 셀 기준). 미지정 시 미표시.
	 */
	statusBar?: StatusBarConfig
	/**
	 * @zh 컬럼 표시/숨김 상태를 localStorage 에 저장/복원할 키. 지정 시 컬럼 가시성 변경을 자동 저장하고,
	 *     재진입(빌드) 시 저장된 상태를 복원합니다.
	 */
	persistKey?: string
	/**
	 * @zh 데이터 갱신 시 값이 바뀐 셀을 잠깐 플래시(애니메이션)로 강조. 숫자 증가=초록, 감소=빨강, 그 외(비숫자)=빨강.
	 * @default false
	 */
	flashOnChange?: boolean
	/** flash 지속 시간(ms, 기본 800) */
	flashDuration?: number
	/**
	 * @zh 데이터(data prop) 갱신을 requestAnimationFrame 으로 coalescing. 한 프레임 안에 여러 번 data 가 바뀌어도
	 *     최신값 1건으로 합쳐 프레임당 최대 1회만 테이블을 갱신/재렌더합니다.
	 * @default false
	 */
	coalesceUpdates?: boolean
	/**
	 * @zh 재정렬 등으로 행 위치가 바뀔 때 옛 위치→새 위치로 부드럽게 이동하는 애니메이션(AG Grid animateRows 유사).
	 * @default true
	 */
	animateRows?: boolean
	/** 행 이동 애니메이션 지속 시간(ms, 기본 250) */
	animateRowsDuration?: number
	/**
	 * @zh 열 설정 메뉴에서 열을 표시/숨길 때, 좌우로 밀리는 열들을 부드럽게 슬라이드시키는 애니메이션.
	 * @default true
	 */
	animateCols?: boolean
	/** 열 표시/숨김 애니메이션 지속 시간(ms, 기본 250) */
	animateColsDuration?: number
}

// 열 설정 UI 의 컬럼 노드 (leaf 또는 group, group 은 재귀 중첩 가능)
interface ColumnLeaf { field: string, title: string, visible: boolean }
interface ColumnGroup { group: true, title: string, children: ColumnNode[] }
type ColumnNode = ColumnLeaf | ColumnGroup;

/** 노드(및 하위 group)의 모든 leaf 를 재귀 수집 */
function gatherLeaves(node: ColumnNode): ColumnLeaf[] {
	return "group" in node ? node.children.flatMap(gatherLeaves) : [node];
}

// 초기화(reset)용 데이터 스냅샷 클론. Tabulator 의 셀 편집은 행 데이터 객체를 직접 변형(mutate)하므로,
// 원복하려면 데이터 수신 시점의 값을 별도 객체로 복제해 둬야 한다.
function cloneRows(rows: any[]): any[] {
	try {
		return structuredClone(rows);
	}
	catch {
		// 클론 불가 값(함수 등) 포함 시 행 단위 얕은 복사로 폴백
		return rows.map(r => ({ ...r }));
	}
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

function ResetIcon() {
	return (
		<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
			<path d="M3 12a9 9 0 1 0 3-6.7" />
			<path d="M3 4v5h5" />
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

/**
 * @zh 코어(ReactTabulatorCore)를 감싸는 프로 컴포넌트.
 *     headerToolbar(quick filter/열 설정/행관리), applyTransaction, persistKey,
 *     FLIP 행/열 애니메이션, flashOnChange/coalesceUpdates, 툴바 다국어를 추가한다.
 *     코어의 확장 훅(onInstance/onBeforeDataUpdate/onAfterDataUpdate)으로만 결합하며
 *     코어 내부 구현에 의존하지 않는다.
 * @en Pro component wrapping ReactTabulatorCore via its extension hooks.
 */
const ReactTabulatorPro = forwardRef<GridApi, ReactTabulatorProps>((props, ref) => {
	const {
		idField,
		columns,
		data,
		options,
		className,
		style,
		onRef,
		headerToolbar,
		statusBar,
		persistKey,
		flashOnChange = false,
		flashDuration = 800,
		coalesceUpdates = false,
		animateRows = true,
		animateRowsDuration = 250,
		animateCols = true,
		animateColsDuration = 250,
		locale,
		...rest
	} = props;

	// headerToolbar 객체에서 항목별 { enabled, config } 파생 (미지정 시 header 미표시)
	const hasHeaderToolbar = headerToolbar != null;
	const qfItem = normalizeToolbarItem<QuickFilterConfig>(headerToolbar?.quickFilter, true);
	const columnSettingItem = normalizeToolbarItem<ColumnSettingButtonConfig>(headerToolbar?.columnSettingButton, false);
	const addItem = normalizeToolbarItem<AddButtonConfig>(headerToolbar?.addButton, false);
	const deleteItem = normalizeToolbarItem<DeleteButtonConfig>(headerToolbar?.deleteButton, false);
	const resetItem = normalizeToolbarItem<ResetButtonConfig>(headerToolbar?.resetButton, false);
	const statusBarItem = normalizeToolbarItem<StatusBarConfig>(statusBar, false);
	const quickFilterKeys = qfItem.config.keys;
	const quickFilterDebounce = qfItem.config.debounce ?? 250;
	const quickFilterExact = qfItem.config.exact ?? false;

	// 다국어: 툴바 문자열. 초기값은 사전에서 동기 해석하고,
	// 인스턴스 생성 후에는 localized 이벤트(getLang)가 소스가 되어 setLocale 시 즉시 갱신된다.
	const [langTexts, setLangTexts] = useState<ReactTabulatorLangTexts>(
		() => resolveWrapperTexts(locale ?? options?.locale, mergeLangs(PRO_LANGS, options?.langs)),
	);
	// 명시적 placeholder prop > locale 사전 (하위호환)
	const quickFilterPlaceholder = qfItem.config.placeholder ?? langTexts.quickFilterPlaceholder;

	const instanceRef = useRef<any>(null);
	const builtRef = useRef(false);

	const gridApi: GridApi = {
		applyTransaction: (transaction: TransactionParams) => {
			const instance = instanceRef.current;
			const { add, addIndex = true, update, remove } = transaction;
			const res: { add: any[], update: any[], remove: any[] } = { add: [], update: [], remove: [] };
			if (!instance)
				return res;

			if (remove && remove.length > 0) {
				instance.deleteRow(remove);
				res.remove = remove;
			}
			if (add && add.length > 0) {
				const newRows = add.map((row: any) => ({ ...row, [idField]: row[idField] || `new_${Date.now()}_${Math.floor(Math.random() * 1000)}`, _isNew: row._isNew ?? true }));
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
		},
	};

	useImperativeHandle(ref, () => gridApi);

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
	// flashOnChange 관련 ref
	const flashOnChangeRef = useRef(flashOnChange);
	flashOnChangeRef.current = flashOnChange;
	const flashDurationRef = useRef(flashDuration);
	flashDurationRef.current = flashDuration;
	const indexFieldRef = useRef<string>(idField);
	indexFieldRef.current = idField;
	// rAF coalescing 관련 ref/상태
	const coalesceRef = useRef(coalesceUpdates);
	coalesceRef.current = coalesceUpdates;
	const rafIdRef = useRef<number | null>(null);
	const pendingDataRef = useRef<any[] | null>(null);
	const [coalescedData, setCoalescedData] = useState<any[] | undefined>(data);
	// 행 이동 애니메이션(FLIP) 관련 ref
	const animateRowsRef = useRef(animateRows);
	animateRowsRef.current = animateRows;
	const animateRowsDurationRef = useRef(animateRowsDuration);
	animateRowsDurationRef.current = animateRowsDuration;
	const animateColsRef = useRef(animateCols);
	animateColsRef.current = animateCols;
	const animateColsDurationRef = useRef(animateColsDuration);
	animateColsDurationRef.current = animateColsDuration;
	// 사용자 헤더 클릭 정렬 시 dataSorting 에서 캡처한 First 위치(renderComplete 에서 재생)
	const pendingFlipTopsRef = useRef<Map<any, number> | null>(null);
	// FLIP 쿨다운: 마지막 슬라이드 시작 시각(performance.now). 고빈도 갱신 시 애니메이션 빈도 제한용.
	const lastFlipAtRef = useRef(0);

	// coalesceUpdates: data prop 변경을 rAF 로 합쳐 프레임당 최대 1회만 코어에 전달
	useEffect(() => {
		if (!coalesceRef.current) {
			return;
		}
		pendingDataRef.current = data ?? [];
		rafIdRef.current ??= requestAnimationFrame(() => {
			rafIdRef.current = null;
			const latest = pendingDataRef.current ?? [];
			pendingDataRef.current = null;
			setCoalescedData(latest);
		});
	}, [data]);

	// 언마운트 시 대기 중인 rAF 취소
	useEffect(() => () => {
		if (rafIdRef.current != null) {
			cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}
	}, []);

	// 코어에 실제로 전달되는 데이터 (coalesce 활성 시 rAF flush 본)
	const effectiveData = coalesceUpdates ? coalescedData : data;

	// Fuse 검색 대상: table.getData()(accessor transform 으로 클론됨) 대신 원본 data 사용.
	// filter 콜백이 받는 row.getData()(원본)와 참조가 일치해야 매칭됨.
	const dataRef = useRef(effectiveData);
	dataRef.current = effectiveData;

	// 초기화(reset)용 스냅샷: 셀 편집이 원본 객체를 mutate 하기 전(데이터 수신 시점)의 값을 클론으로 보존.
	// 부모가 새 데이터를 보내면 그것이 새 기준(init)이 된다. reset 미사용 시 비용 0 (스냅샷 생략).
	const resetEnabledRef = useRef(resetItem.enabled);
	resetEnabledRef.current = resetItem.enabled;
	const initialDataRef = useRef<any[]>([]);
	// 초기화로 테이블에 넣은 복원본 — quick filter 의 참조 매칭이 테이블 실제 행과 일치하도록 검색 소스로 사용
	const restoredDataRef = useRef<any[] | null>(null);
	useEffect(() => {
		restoredDataRef.current = null; // 부모 데이터가 새로 오면 복원본 무효화
		if (resetEnabledRef.current) {
			initialDataRef.current = cloneRows(effectiveData ?? []);
		}
	}, [effectiveData]);

	// Quick Filter 검색용 캐시 (Fuse 인스턴스 및 파싱된 텍스트 재사용)
	// set filter 상태: field → 허용 값 키 Set (미존재 = 필터 없음)
	const setFilterStateRef = useRef<Map<string, Set<string>>>(new Map());
	// 팝업(바닐라 DOM) 빌더에서 최신 툴바 문자열을 읽기 위한 ref
	const langTextsRef = useRef(langTexts);
	langTextsRef.current = langTexts;

	const quickFilterCacheRef = useRef<{ data: any[], keys: string[], searchRows: any[], fuse: Fuse<any> | null }>({
		data: [],
		keys: [],
		searchRows: [],
		fuse: null,
	});

	// 전체 row 데이터를 Fuse.js 로 fuzzy 검색하여 매칭되는 행만 표시
	// quick filter 매칭 행 Set 계산 (검색어가 없으면 null = 제한 없음)
	const computeQuickFilterMatched = (inst: any, term: string): Set<any> | null => {
		const value = term.trim();
		if (!value) {
			return null;
		}
		// 원본 전체 데이터 (filter 콜백의 row.getData()와 동일 참조). 초기화 직후엔 복원본이 테이블 행과 참조 일치.
		const rows: any[] = restoredDataRef.current ?? dataRef.current ?? [];
		const allFieldKeys = inst.getColumns(true).filter((col: any) => col.getField()).map((col: any) => col.getField());
		const keys = quickFilterKeysRef.current ?? allFieldKeys;

		const cache = quickFilterCacheRef.current;
		let { searchRows, fuse } = cache;
		const keysChanged = cache.keys.length !== keys.length || cache.keys.some((k, i) => k !== keys[i]);

		// 데이터나 키가 변경된 경우에만 파싱 및 인덱싱 재수행
		if (cache.data !== rows || keysChanged) {
			// 행의 모든 컬럼 값을 하나의 문자열로 합쳐 "행 전체 컬럼" 기준으로 검색 (AG Grid quick filter 방식)
			searchRows = rows.map(row => ({
				row,
				text: keys.map((k: string) => {
					const v = getByPath(row, k);
					return v == null ? "" : String(v);
				}).join(" "),
			}));

			// fuzzy 검색용 Fuse 인스턴스 재생성
			fuse = new Fuse(searchRows, { keys: ["text"], threshold: 0.3, ignoreLocation: true });
			quickFilterCacheRef.current = { data: rows, keys, searchRows, fuse };
		}

		if (quickFilterExactRef.current) {
			// 완전 부분일치: 대소문자 무시 substring 검색
			const needle = value.toLowerCase();
			return new Set(searchRows.filter(sr => sr.text.toLowerCase().includes(needle)).map(sr => sr.row));
		}
		// fuzzy 검색
		return new Set(fuse!.search(value).map(res => res.item.row));
	};

	// quick filter(행 참조 매칭) 와 set filter(필드 값 매칭) 를 AND 로 결합해 단일 필터로 적용.
	// (Tabulator setFilter 는 기존 프로그램 필터를 대체하므로 두 필터를 하나의 콜백으로 합친다)
	const applyFilters = (term?: string) => {
		const inst = instanceRef.current;
		if (!inst || !builtRef.current) {
			return;
		}
		const matched = computeQuickFilterMatched(inst, term ?? quickFilterValueRef.current);
		const setEntries = Array.from(setFilterStateRef.current.entries());
		if (!matched && setEntries.length === 0) {
			inst.clearFilter(); // 활성 필터 없음
			return;
		}
		inst.setFilter((rowData: any) => {
			if (matched && !matched.has(rowData)) {
				return false;
			}
			for (const [field, allowed] of setEntries) {
				if (!allowed.has(setFilterValueKey(getByPath(rowData, field)))) {
					return false;
				}
			}
			return true;
		});
	};
	const applyFiltersRef = useRef(applyFilters);
	applyFiltersRef.current = applyFilters;

	// ── Set Filter (엑셀식 고유값 체크박스 필터) ──
	// 컬럼 정의 `setFilter: true` → Tabulator headerPopup 로 고유값 목록 팝업 부착.
	// 선택 변경 시 상태 갱신 + 헤더 아이콘 활성 표시 + 결합 필터 재적용.
	const handleSetFilterChange = (field: string, values: Set<string> | null) => {
		const map = setFilterStateRef.current;
		if (values) {
			map.set(field, values);
		}
		else {
			map.delete(field);
		}
		instanceRef.current?.getColumn?.(field)?.getElement?.()?.classList.toggle("rt-set-filter-active", !!values);
		applyFiltersRef.current();
	};
	const handleSetFilterChangeRef = useRef(handleSetFilterChange);
	handleSetFilterChangeRef.current = handleSetFilterChange;

	// 팝업 빌더는 1회 생성 (내부는 전부 ref 경유라 stale 없음)
	const setFilterPopupRef = useRef<((e: any, column: any, onRendered: any) => HTMLElement) | null>(null);
	setFilterPopupRef.current ??= createSetFilterPopup({
		getRows: () => restoredDataRef.current ?? dataRef.current ?? [],
		getSelected: field => setFilterStateRef.current.get(field) ?? null,
		setSelected: (field, values) => handleSetFilterChangeRef.current(field, values),
		getTexts: () => ({
			search: langTextsRef.current.setFilterSearch,
			selectAll: langTextsRef.current.setFilterSelectAll,
			empty: langTextsRef.current.setFilterEmpty,
			overflow: langTextsRef.current.setFilterOverflow,
		}),
	});

	// ── 상태바 range 집계 ──
	// range 선택/데이터 변경 시 집계를 재계산. 드래그 중 rangeChanged 가 다발로 발생하므로 rAF 로 코얼레싱.
	const [rangeStats, setRangeStats] = useState<RangeStats | null>(null);
	const statusBarEnabledRef = useRef(statusBarItem.enabled);
	statusBarEnabledRef.current = statusBarItem.enabled;
	const rangeStatsRafRef = useRef<number | null>(null);
	const scheduleRangeStats = () => {
		if (!statusBarEnabledRef.current) {
			return;
		}
		rangeStatsRafRef.current ??= requestAnimationFrame(() => {
			rangeStatsRafRef.current = null;
			const instance = instanceRef.current;
			setRangeStats(instance ? computeRangeStats(instance) : null);
		});
	};

	// 언마운트 시 대기 중인 집계 rAF 취소
	useEffect(() => () => {
		if (rangeStatsRafRef.current != null) {
			cancelAnimationFrame(rangeStatsRafRef.current);
			rangeStatsRafRef.current = null;
		}
	}, []);

	// 모든 set filter 해제 (초기화/추가 버튼 경로에서 사용) — 상태 + 헤더 아이콘 표시 정리
	const clearAllSetFilters = (instance: any) => {
		for (const field of setFilterStateRef.current.keys()) {
			instance?.getColumn?.(field)?.getElement?.()?.classList.remove("rt-set-filter-active");
		}
		setFilterStateRef.current.clear();
	};

	// setFilter 지정 컬럼에 headerPopup/아이콘 주입 (커스텀 키 setFilter 는 Tabulator 경고 방지를 위해 제거)
	const processedColumns = useMemo(() => {
		const transform = (cols?: ProColumnDefinition[]): any[] | undefined => cols?.map((col) => {
			const { setFilter, ...rest } = col as any;
			const out: any = { ...rest };
			if (col.columns) {
				out.columns = transform(col.columns);
			}
			if (setFilter && out.field) {
				out.headerPopup = (e: any, column: any, onRendered: any) => setFilterPopupRef.current!(e, column, onRendered);
				out.headerPopupIcon = SET_FILTER_ICON_HTML;
			}
			return out;
		});
		return transform(columns);
		// setFilterPopupRef 는 ref 라 의존성 불필요 — columns 변경 시에만 재계산
	}, [columns]);

	// 실제 검색 실행은 debounce (연속 입력 시 마지막 입력 기준 1회만 실행)
	const { cancel: cancelQuickFilter, run: runQuickFilter } = useDebounceFn(
		(value: string) => applyFilters(value),
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
	const persistEnabledRef = useRef(persistEnabled);
	persistEnabledRef.current = persistEnabled;

	// persistEnabled 토글 반영: off → 저장값 제거 (on 은 이후 컬럼 변경 시 writer 가 저장)
	useEffect(() => {
		if (!persistKey || !builtRef.current) {
			return;
		}
		if (!persistEnabled) {
			PERSIST_TYPES.forEach(type => localStorage.removeItem(persistStorageKey(persistKey, type)));
		}
	}, [persistEnabled, persistKey]);

	// ── 코어 확장 훅 ──

	// 인스턴스 생성 직후(tableBuilt 이전): 프로 이벤트 리스너 부착
	const handleInstance = (instance: any) => {
		instanceRef.current = instance;

		// 현재 locale 사전에서 툴바 문자열을 읽어 React 상태에 반영.
		// (getLang() 은 default 사전 위에 현재 locale 을 덮어쓴 결과라 누락 키는 자동 폴백됨)
		const applyLangTexts = () => {
			const rt = instance.getLang?.()?.reactTabulator;
			if (rt) {
				setLangTexts(prev => ({ ...prev, ...rt }));
			}
		};
		// setLocale 시 코어 UI 는 Tabulator 가 자체 갱신하고, 툴바는 여기서 갱신한다.
		instance.on("localized", applyLangTexts);

		instance.on("tableBuilt", () => {
			builtRef.current = true;
			// 초기 setLocale 의 localized 는 리스너 등록 전(생성자 내부)에 발생하므로 1회 시딩
			applyLangTexts();
		});

		// 사용자 헤더 클릭 정렬: 정렬 직전(행이 아직 옛 위치)에 First 위치를 캡처.
		// 프로그램적 정렬(코어의 updateData/replaceData 경로, _rtProgrammaticSort)은
		// 수동 FLIP(onBefore/AfterDataUpdate)이 처리하므로 여기서는 건너뛴다(이중 방지).
		instance.on("dataSorting", () => {
			if ((instance as any)._rtProgrammaticSort || !animateRowsRef.current) {
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

		// 렌더 완료 후: 사용자 정렬로 캡처해 둔 First 가 있으면 새 위치로 FLIP 재생(재배치 끝난 뒤라 정확)
		instance.on("renderComplete", () => {
			if (pendingFlipTopsRef.current) {
				playSortFlip(instance, pendingFlipTopsRef.current, animateRowsDurationRef.current);
				pendingFlipTopsRef.current = null;
			}
		});

		// 상태바: range 선택 생성/변경/해제 및 셀 편집 시 집계 갱신
		instance.on("rangeChanged", scheduleRangeStats);
		instance.on("rangeAdded", scheduleRangeStats);
		instance.on("rangeRemoved", scheduleRangeStats);
		instance.on("cellEdited", scheduleRangeStats);

		onRef?.({ current: gridApi });
	};

	// FLIP 쿨다운 가드: 직전 슬라이드가 끝난 뒤(>= duration)에만 새 슬라이드를 시작한다.
	// 고빈도(주기 < duration) 갱신에서 애니메이션이 끝까지 재생되도록 하고, reflow 를 duration 당 1회로 제한.
	const beginFlip = (instance: any): Map<any, number> | null => {
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

	// 데이터 갱신 직전: FLIP First 캡처 + flash 대상 diff (token 으로 after 에 전달)
	const handleBeforeDataUpdate = ({ next, prev, instance, sameRowSet }: { next: any[], prev: any[], instance: any, sameRowSet: boolean }) => {
		const tops = beginFlip(instance);
		const flash: FlashCell[] = flashOnChangeRef.current
			? computeFlashCells(prev, next, indexFieldRef.current, sameRowSet)
			: [];
		return { tops, flash };
	};

	// 데이터 갱신 완료 후(재정렬 반영 뒤): FLIP 재생 → quick filter 재적용 → flash
	const handleAfterDataUpdate = ({ instance, token }: { instance: any, token?: any }) => {
		if (token?.tops) {
			playRowFlip(instance, token.tops, animateRowsDurationRef.current);
		}
		if (quickFilterValueRef.current) {
			applyFilters();
		}
		if (flashOnChangeRef.current && token?.flash?.length) {
			flashCells(instance, token.flash, indexFieldRef.current, flashDurationRef.current);
		}
		// 선택 영역 아래 값이 바뀌었을 수 있으므로 상태바 집계 갱신
		scheduleRangeStats();
	};

	// ── 코어에 전달할 옵션 구성 ──

	// persistKey 편의 기능: 내장 persistence 를 커스텀 reader/writer 로 게이팅
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

	// 행 추가/삭제 상태(_isNew/_isDeleted) 클래스를 행에 반영하는 rowFormatter 래핑 (사용자 formatter 는 유지)
	const customRowFormatter = options?.rowFormatter ?? (rest as any).rowFormatter;
	const enhancedRowFormatter = (row: any) => {
		const rowData = row.getData();
		setTimeout(() => {
			const el: HTMLElement | undefined = row.getElement?.();
			if (el) {
				el.classList.toggle("rt-row-new", !!rowData._isNew);
				el.classList.toggle("rt-row-deleted", !!rowData._isDeleted);
			}
		}, 0);
		customRowFormatter?.(row);
	};

	const mergedOptions = {
		...persistOptions,
		...options,
		rowFormatter: enhancedRowFormatter,
		// 프로 툴바 사전을 얹음 (코어가 코어 사전 위에 다시 병합, 사용자 정의 최우선)
		langs: mergeLangs(PRO_LANGS, options?.langs),
	};

	const anyToolbarItem = qfItem.enabled || columnSettingItem.enabled || addItem.enabled || deleteItem.enabled || resetItem.enabled;
	const showHeader = hasHeaderToolbar && anyToolbarItem;

	// 초기화: 확인 후 정렬/quick filter/페이지를 초기화하고, 모든 로컬 변경(수정·추가·삭제 표시)을 버리고
	// 초기 스냅샷 데이터로 원복한다. 스냅샷을 다시 클론해 넣어 이후 편집이 스냅샷을 오염시키지 않게 한다.
	// 로컬 변경(행 추가/삭제 표시/셀 수정) 존재 여부 — 초기화 버튼의 경고창 표시 조건
	const hasLocalChanges = (instance: any): boolean => {
		const rows: any[] = instance.getData?.() ?? [];
		if (rows.some((r: any) => r?._isNew || r?._isDeleted)) {
			return true;
		}
		// 편집된 셀 중 실제로 초기값과 다른 것만 변경으로 간주 (수정 후 원래 값으로 되돌린 셀은 제외)
		const edited: any[] = instance.getEditedCells?.() ?? [];
		return edited.some((c: any) => c.getValue?.() !== c.getInitialValue?.());
	};

	const handleResetData = () => {
		const instance = instanceRef.current;
		if (!instance) {
			return;
		}
		// 변경사항(추가/삭제/수정)이 있을 때만 사용자에게 경고 후 확인을 받는다.
		// 변경이 없으면 조용히 정렬/필터/페이지만 초기화 (데이터는 이미 초기 상태이므로 원복 생략).
		const changed = hasLocalChanges(instance);
		if (changed) {
			// 자족적(무의존) 패키지 유지를 위해 모달 라이브러리 대신 네이티브 confirm 사용
			// eslint-disable-next-line no-alert
			if (!window.confirm(langTexts.resetDataConfirm)) {
				return;
			}
		}
		// 검색/정렬/페이지 초기화
		cancelQuickFilter(); // 대기 중인 debounce 검색이 초기화 후 재적용되지 않도록 취소
		setQuickFilterValue("");
		quickFilterValueRef.current = "";
		clearAllSetFilters(instance);
		instance.clearFilter();
		instance.clearSort();
		const page = instance.getPage?.();
		if (typeof page === "number" && page > 1) {
			instance.setPage(1);
		}
		if (changed) {
			// 편집 추적을 비운 뒤 데이터 원복 (신규 행 제거, _isDeleted/수정값 원복 — 새 행 엘리먼트로 재렌더되어 수정 표시도 사라짐)
			instance.getEditedCells?.().forEach((c: any) => c.clearEdited?.());
			const restored = cloneRows(initialDataRef.current);
			restoredDataRef.current = restored;
			instance.replaceData(restored);
		}
		instance.deselectRow?.();
	};

	const handleAddRow = (rowsToAdd?: any[]) => {
		const add = rowsToAdd && rowsToAdd.length > 0 ? rowsToAdd : [{}];
		const instance = instanceRef.current;

		// 신규 행은 전체 데이터 최상단에 삽입되는데, 정렬/quick filter/페이지 상태가 남아 있으면
		// 새 행이 현재 화면에 보이지 않거나(다른 페이지·정렬 위치) 필터에 걸러지는 문제가 있다.
		// → 초기화 대상이 있으면 사용자에게 고지·확인 후 모두 초기화하고 첫 행에 추가한다.
		if (instance) {
			const hasSort = (instance.getSorters?.() ?? []).length > 0;
			const hasQuickFilter = !!quickFilterValueRef.current.trim();
			const hasSetFilter = setFilterStateRef.current.size > 0;
			const page = instance.getPage?.(); // number | false (페이지네이션 비활성 시 false)
			const notFirstPage = typeof page === "number" && page > 1;

			if (hasSort || hasQuickFilter || hasSetFilter || notFirstPage) {
				// 자족적(무의존) 패키지 유지를 위해 모달 라이브러리 대신 네이티브 confirm 사용
				// eslint-disable-next-line no-alert
				if (!window.confirm(langTexts.addRowResetConfirm)) {
					return; // 사용자가 취소 → 추가하지 않음
				}
				if (hasSort) {
					instance.clearSort();
				}
				if (hasQuickFilter) {
					cancelQuickFilter(); // 대기 중인 debounce 검색이 초기화 후 재적용되지 않도록 취소
					setQuickFilterValue("");
					quickFilterValueRef.current = "";
				}
				if (hasSetFilter) {
					clearAllSetFilters(instance);
				}
				if (hasQuickFilter || hasSetFilter) {
					instance.clearFilter();
				}
				if (notFirstPage) {
					instance.setPage(1);
				}
			}
		}

		// 내부 툴바 액션도 applyTransaction 을 통하도록 단일화 (초기 상태이므로 최상단 = 첫 번째 라인)
		gridApi.applyTransaction({ add });
	};

	const handleDeleteRow = (rowsToDelete?: any[]) => {
		const instance = instanceRef.current;
		if (!instance)
			return;

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

		if (!targetRows || targetRows.length === 0)
			return;

		const remove: any[] = [];
		const update: any[] = [];

		targetRows!.forEach((row: any) => {
			const rowComp = typeof row.getData === "function" ? row : instance.getRow(row[idField] || row);
			if (!rowComp)
				return;
			const rowData = rowComp.getData();
			if (rowData._isNew)
				remove.push(rowComp);
			else update.push({ [idField]: rowData[idField], _isDeleted: !rowData._isDeleted });
		});

		// 내부 툴바 액션도 applyTransaction 을 통하도록 단일화
		gridApi.applyTransaction({ remove, update });
		instance.deselectRow();
	};

	return (
		// header + table 을 하나의 컨테이너로 묶어 단일 컴포넌트처럼 보이게 함 (antd 테마 border/radius 는 컨테이너에 적용)
		// flex 세로 배치 + height:100% 로 부모의 남는 영역을 채움 (consumer 가 style 로 override 가능)
		<div className={className} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, ...style }}>
			{/* 상단 header 툴바: 왼쪽 quick filter, 오른쪽 열 설정/행관리 */}
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
						{qfItem.enabled && (
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
						{addItem.enabled && (
							<Button
								size="small"
								icon={<PlusIcon />}
								onClick={(e) => {
									e.stopPropagation();
									handleAddRow();
								}}
								onMouseDown={(e) => {
									e.preventDefault();
									e.stopPropagation();
								}}
							>
								{addItem.config.label ?? langTexts.addRow}
							</Button>
						)}
						{deleteItem.enabled && (
							<Button
								size="small"
								icon={<MinusIcon />}
								onClick={(e) => {
									e.stopPropagation();
									handleDeleteRow();
								}}
								onMouseDown={(e) => {
									e.preventDefault();
									e.stopPropagation();
								}}
							>
								{deleteItem.config.label ?? langTexts.deleteRow}
							</Button>
						)}
						{resetItem.enabled && (
							<Button
								size="small"
								icon={<ResetIcon />}
								onClick={(e) => {
									e.stopPropagation();
									handleResetData();
								}}
								onMouseDown={(e) => {
									e.preventDefault();
									e.stopPropagation();
								}}
							>
								{resetItem.config.label ?? langTexts.resetData}
							</Button>
						)}
						{columnSettingItem.enabled && (
							<Popover
								placement="bottomRight"
								title={columnSettingItem.config.label ?? langTexts.columnSetting}
								onOpenChange={open => open && refreshColumnList()}
								content={(
									<div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
										{persistKey && (
											<>
												<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
													<span>{langTexts.persistColumns}</span>
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
								<Button size="small" icon={<SettingIcon />}>{columnSettingItem.config.label ?? langTexts.columnSetting}</Button>
							</Popover>
						)}
					</div>
				</div>
			)}
			<ReactTabulatorCore
				{...rest}
				idField={idField}
				columns={processedColumns}
				data={effectiveData}
				options={mergedOptions}
				locale={locale}
				onInstance={handleInstance}
				onBeforeDataUpdate={handleBeforeDataUpdate}
				onAfterDataUpdate={handleAfterDataUpdate}
				style={{ flex: 1, minHeight: 0, height: undefined }}
			/>
			{/* 하단 상태바: range 선택 집계 (개수/합계/평균/최소/최대) — 선택이 없으면 빈 바 유지(높이 점프 방지) */}
			{statusBarItem.enabled && (
				<div
					className="rt-status-bar"
					style={{
						display: "flex",
						justifyContent: "flex-end",
						alignItems: "center",
						gap: 16,
						padding: "4px 12px",
						minHeight: 26,
						fontSize: 12,
					}}
				>
					{rangeStats && (
						<>
							<span>
								{langTexts.statusCount}
								{": "}
								<strong>{statusNumberFormat.format(rangeStats.count)}</strong>
							</span>
							{rangeStats.numeric > 0 && (
								<>
									<span>
										{langTexts.statusSum}
										{": "}
										<strong>{statusNumberFormat.format(rangeStats.sum)}</strong>
									</span>
									<span>
										{langTexts.statusAvg}
										{": "}
										<strong>{statusNumberFormat.format(rangeStats.avg)}</strong>
									</span>
									<span>
										{langTexts.statusMin}
										{": "}
										<strong>{statusNumberFormat.format(rangeStats.min)}</strong>
									</span>
									<span>
										{langTexts.statusMax}
										{": "}
										<strong>{statusNumberFormat.format(rangeStats.max)}</strong>
									</span>
								</>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
});

export default ReactTabulatorPro;
