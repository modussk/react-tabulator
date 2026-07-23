import type { CSSProperties } from "react";
import type { Tabulator as TabulatorTypes } from "./types/TabulatorTypes";

import { SearchOutlined, SettingOutlined } from "@ant-design/icons";
import { useDebounceFn } from "ahooks";
import { Button, Checkbox, Divider, Input, Popover, Switch } from "antd";
import Fuse from "fuse.js";
import { useEffect, useId, useRef, useState } from "react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import { propsToOptions } from "./ConfigUtils";
import "tabulator-tables/dist/css/tabulator.min.css";

export interface ReactTabulatorOptions extends TabulatorTypes.Options {
	[k: string]: any
}

export interface ColumnDefinition extends TabulatorTypes.ColumnDefinition {}

export interface ReactTabulatorProps {
	columns?: ColumnDefinition[]
	data?: any[]
	options?: any
	events?: Record<string, (...args: any[]) => void>
	className?: string
	style?: CSSProperties
	/** Tabulator 인스턴스 ref 를 상위로 전달 */
	onRef?: (ref: React.RefObject<any>) => void
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
	 *     저장 스위치는 persistKey 가 지정된 경우에만 나타납니다.
	 * @en Whether to show the built-in column-settings UI (show/hide columns + save switch) at the header-right.
	 *     The save switch appears only when persistKey is set.
	 * @default false
	 */
	columnSetting?: boolean
}

// 내장 persistence 저장 키 규칙: `${persistenceID}-${type}` (type 예: "columns")
const persistStorageKey = (id: string, type: string) => `${id}-${type}`;

// Tabulator 는 바닐라 JS 라이브러리이므로 기본 옵션은 기존 동작과 동일하게 유지합니다.
const DEFAULT_OPTIONS = {
	layout: "fitDataFill",
	resizableRowGuide: true,
	resizableColumnGuide: true,
	selectableRange: true,
	selectableRangeColumns: true,
	selectableRangeRows: true,
	// 기본 range 생성 시 첫 셀로 포커스가 튀는 현상 방지 (실제 클릭 셀 포커스는 cellClick 이 처리)
	selectableRangeAutoFocus: false,
	// 정렬은 헤더 전체가 아닌 정렬 아이콘 클릭 시에만 동작 (헤더 클릭 시 컬럼 범위 선택과의 충돌 방지)
	headerSortClickElement: "icon",
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
		formatter: (cell: any) => {
			const table = cell.getTable();
			const posOnPage = cell.getRow().getPosition(true) || 0;
			const page = table.getPage(); // number | false (페이지네이션 비활성 시 false)
			const pageSize = table.getPageSize(); // number | true
			if (!page || typeof pageSize !== "number") {
				return posOnPage;
			}
			return (page - 1) * pageSize + posOnPage;
		},
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
export default function ReactTabulator(props: ReactTabulatorProps) {
	const {
		columns,
		data,
		options,
		events,
		className,
		style,
		onRef,
		headerToolbar,
		persistKey,
	} = props;

	// headerToolbar 객체에서 값 파생 (미지정 시 header 미표시)
	const hasHeaderToolbar = headerToolbar != null;
	const columnSettingEnabled = headerToolbar?.columnSetting === true;
	const qfRaw = headerToolbar?.quickFilter;
	const quickFilter = qfRaw === undefined ? true : (typeof qfRaw === "boolean" ? qfRaw : true);
	const qfConfig = (typeof qfRaw === "object" && qfRaw) ? qfRaw : {};
	const quickFilterKeys = qfConfig.keys;
	const quickFilterPlaceholder = qfConfig.placeholder ?? "검색";
	const quickFilterDebounce = qfConfig.debounce ?? 250;
	const quickFilterExact = qfConfig.exact ?? false;

	const domRef = useRef<HTMLDivElement>(null);
	const instanceRef = useRef<any>(null);
	const builtRef = useRef(false);
	const reactId = useId().replace(/:/g, "");

	// 열 설정 저장(persist) on/off — persistKey 가 있을 때 저장 플래그로 초기화 (내장 관리)
	const [persistEnabled, setPersistEnabled] = useState<boolean>(
		() => (persistKey ? localStorage.getItem(persistStorageKey(persistKey, "save-enabled")) === "1" : false),
	);
	// 내장 열 설정 UI 의 컬럼 목록
	const [columnList, setColumnList] = useState<{ field: string, title: string, visible: boolean }[]>([]);

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
		// 행의 모든 컬럼 값을 하나의 문자열로 합쳐 "행 전체 컬럼" 기준으로 검색 (AG Grid quick filter 방식)
		const getByPath = (obj: any, path: string) => path.split(".").reduce((o, p) => (o == null ? o : o[p]), obj);
		const searchRows = rows.map(row => ({
			row,
			text: keys.map((k: string) => {
				const v = getByPath(row, k);
				return v == null ? "" : String(v);
			}).join(" "),
		}));

		let matched: Set<any>;
		if (quickFilterExactRef.current) {
			// 완전 부분일치: 대소문자 무시 substring 검색
			const needle = value.toLowerCase();
			matched = new Set(searchRows.filter(sr => sr.text.toLowerCase().includes(needle)).map(sr => sr.row));
		}
		else {
			// fuzzy 검색
			const fuse = new Fuse(searchRows, { keys: ["text"], threshold: 0.3, ignoreLocation: true });
			matched = new Set(fuse.search(value).map(res => res.item.row));
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
	// 현재 인스턴스의 컬럼 목록/가시성을 UI 상태에 반영 (field 를 가진 leaf 컬럼만)
	const refreshColumnList = () => {
		const inst = instanceRef.current;
		if (!inst) {
			return;
		}
		setColumnList(
			inst.getColumns(true)
				.filter((col: any) => col.getField())
				.map((col: any) => ({
					field: col.getField(),
					title: col.getDefinition().title ?? col.getField(),
					visible: col.isVisible(),
				})),
		);
	};

	// 컬럼 표시/숨김 토글 (persistence 는 columnVisibilityChanged 로 자동 저장됨)
	const toggleColumnVisible = (field: string, checked: boolean) => {
		const inst = instanceRef.current;
		if (!inst) {
			return;
		}
		if (checked) {
			inst.showColumn(field);
		}
		else {
			inst.hideColumn(field);
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
			// persistKey 지정 시 Tabulator 내장 persistence 로 컬럼 가시성/폭/순서(그룹 포함)를 저장·복원.
			// on/off 는 커스텀 reader/writer 에서 persistEnabledRef 로 게이트.
			const persistOptions = persistKey
				? {
					persistenceID: persistKey,
					persistence: { columns: ["visible", "width"] },
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
			const instance = new Tabulator(el, {
				columns,
				data: data ?? [],
				...DEFAULT_OPTIONS,
				...persistOptions,
				...propOptions,
				...options,
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
			onRef?.(instanceRef);
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

	// 데이터 변경: 전체 재초기화 대신 replaceData 로 증분 갱신 (변경 후 quick filter 재적용)
	useEffect(() => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current) {
			return;
		}
		instance.replaceData(data ?? []).then(() => {
			if (quickFilterValueRef.current) {
				applyQuickFilter(quickFilterValueRef.current);
			}
		}).catch(() => {});
		// applyQuickFilter 는 ref 기반이라 의존성에 포함하지 않습니다.
	}, [data]);

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
			localStorage.removeItem(persistStorageKey(persistKey, "columns"));
		}
	}, [persistEnabled, persistKey]);

	const showHeader = hasHeaderToolbar && (quickFilter || columnSettingEnabled);

	return (
		// header + table 을 하나의 컨테이너로 묶어 단일 컴포넌트처럼 보이게 함 (antd 테마 border/radius 는 컨테이너에 적용)
		<div className={className} style={style}>
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
					<div>
						{quickFilter && (
							<Input
								size="small"
								allowClear
								prefix={<SearchOutlined />}
								placeholder={quickFilterPlaceholder}
								value={quickFilterValue}
								onChange={e => onQuickFilterChange(e.target.value)}
								style={{ width: 220 }}
							/>
						)}
					</div>
					<div>
						{columnSettingEnabled && (
							<Popover
								trigger="click"
								placement="bottomRight"
								title="열 설정"
								onOpenChange={open => open && refreshColumnList()}
								content={(
									<div className="flex flex-col gap-1" style={{ minWidth: 180 }}>
										{persistKey && (
											<>
												<div className="flex items-center justify-between">
													<span>열 설정 저장</span>
													<Switch size="small" checked={persistEnabled} onChange={toggleSaveColumns} />
												</div>
												<Divider className="my-1" />
											</>
										)}
										<div className="flex max-h-80 flex-col gap-1 overflow-auto">
											{columnList.map((col, idx) => (
												<Checkbox
													key={`${col.field}-${idx}`}
													checked={col.visible}
													onChange={e => toggleColumnVisible(col.field, e.target.checked)}
												>
													{col.title}
												</Checkbox>
											))}
										</div>
									</div>
								)}
							>
								<Button size="small" icon={<SettingOutlined />}>열 설정</Button>
							</Popover>
						)}
					</div>
				</div>
			)}
			<div ref={domRef} id={reactId} />
		</div>
	);
}
