// SPDX-License-Identifier: MIT
import type { CSSProperties } from "react";
import type { Tabulator as TabulatorTypes } from "./types/TabulatorTypes";

import { useEffect, useId, useRef } from "react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import { propsToOptions } from "./ConfigUtils";
import { CORE_LANGS, mergeLangs } from "./i18n";
import { sweepReactRoots } from "./react-formatter";
import "tabulator-tables/dist/css/tabulator.min.css";

export interface ReactTabulatorOptions extends TabulatorTypes.Options {
	[k: string]: any
}

export interface ColumnDefinition extends TabulatorTypes.ColumnDefinition {}

/** 확장 훅: 데이터 갱신 직전 컨텍스트 (pro 패키지의 애니메이션/flash 부착점) */
export interface DataUpdateContext {
	next: any[]
	prev: any[]
	instance: any
	/** 행 집합/순서가 동일해 updateData(증분) 경로를 타는지 여부 */
	sameRowSet: boolean
}

/** 확장 훅: 데이터 갱신 완료 컨텍스트 (재정렬 반영 후) */
export interface DataUpdateResult extends DataUpdateContext {
	/** 증분 경로에서 실제 변경된 필드 집합 (전체 교체 경로에서는 undefined) */
	changedFields?: Set<string>
	/** onBeforeDataUpdate 가 반환한 값 그대로 */
	token?: any
}

export interface ReactTabulatorCoreProps {
	/** 고유 식별자(PK)로 사용할 필드명 (필수) */
	idField: string
	columns?: ColumnDefinition[]
	data?: any[]
	options?: any
	events?: Record<string, (...args: any[]) => void>
	className?: string
	style?: CSSProperties
	/** Tabulator 인스턴스 ref 전달 */
	onRef?: (ref: { current: any }) => void
	/**
	 * @zh 행번호(전체 순번) 컬럼 표시 여부. false 이면 행번호 컬럼을 숨깁니다.
	 * @default true
	 */
	rowNumber?: boolean
	/**
	 * @zh 테이블 최초 렌더링 시 첫 번째 셀 자동 선택 여부.
	 * @default false
	 */
	autoSelectFirstCell?: boolean
	/**
	 * @zh 표시 언어. Tabulator `locale` 옵션과 동일한 의미: "ko" 같은 locale 문자열, true(브라우저 언어 자동 감지),
	 *     미지정/false 면 기본(영어). 런타임에 값을 바꾸면 setLocale 로 즉시 전환됩니다.
	 *     사전 확장은 `options.langs` 로 전달(코어 기본 사전에 깊은 병합).
	 */
	locale?: string | boolean
	/**
	 * @zh (확장 포인트) Tabulator 인스턴스 생성 직후 호출 — tableBuilt 이전이므로 이벤트 리스너 부착에 안전.
	 *     pro 패키지가 툴바/애니메이션/트랜잭션 기능을 부착하는 지점.
	 */
	onInstance?: (instance: any) => void
	/**
	 * @zh (확장 포인트) 데이터 갱신 직전 호출. 반환값은 onAfterDataUpdate 의 token 으로 전달됩니다.
	 *     실제 갱신(updateData/replaceData)이 일어나는 경우에만 호출됩니다.
	 */
	onBeforeDataUpdate?: (ctx: DataUpdateContext) => any
	/**
	 * @zh (확장 포인트) 데이터 갱신 완료 후(활성 정렬 재적용 뒤) 호출.
	 */
	onAfterDataUpdate?: (result: DataUpdateResult) => void
	[k: string]: any
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

// 두 행의 값 diff: 변경된 필드만 추출 (updateData 최소 갱신용). 배열은 얕은 비교, 그 외 객체는 스킵.
function diffRowFields(oldRow: any, newRow: any): Record<string, any> {
	const fields: Record<string, any> = {};
	for (const field of Object.keys(newRow)) {
		const a = oldRow[field];
		const b = newRow[field];
		if (a === b) {
			continue;
		}
		// 배열: 얕은 비교로 변경 감지 → 값만 갱신(셀 재렌더/재draw). (sparkline 등)
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
	}
	return fields;
}

// updateData(증분 갱신)는 재정렬을 트리거하지 않는다. 활성 정렬이 있으면 현재 sorter 로 재정렬을 재적용해
// 갱신된 값이 정렬 순서/현재 페이지에 반영되도록 한다. (정렬 없으면 no-op)
// setSort 는 현재 뷰포트 전체를 재렌더하므로, changedFields 로 "정렬 중인 필드가 실제 바뀐 경우"에만 재정렬한다.
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
// 현재 정렬/필터/페이지 기준 "표시 순서" 전역 순번을 계산한다.
function computeRowNumber(row: any, table: any): number {
	// row.getPosition() 은 내부에서 isDisplayed() → getDisplayRows().includes() 선형 탐색을 수행해
	// 대량 데이터(수십만~백만 행) 하단에서 호출당 O(n) 이 된다. Tabulator 가 display 파이프라인에서
	// 이미 캐싱해 둔 내부 position 을 직접 읽어 O(1) 로 처리한다. (RowComponent/내부 Row 모두 지원)
	const internal = row?._row ?? row;
	const cached = internal?.position;
	const posOnPage = typeof cached === "number" && cached > 0 ? cached : (row.getPosition?.(true) || 0);
	const page = table.getPage?.(); // number | false (페이지네이션 비활성 시 false)
	const pageSize = table.getPageSize?.(); // number | true
	if (!page || typeof pageSize !== "number") {
		return posOnPage;
	}
	return (page - 1) * pageSize + posOnPage;
}

// 순번 3자리 콤마 구분 표기 (locale 와 무관하게 콤마 고정)
const rowNumberGroupFormat = new Intl.NumberFormat("en-US");

// 순번 표시 문자열. 인스턴스 플래그(_rtRowNumberComma, 기본 on)로 3자리 구분자 on/off.
function formatRowNumber(n: number, table: any): string {
	return table?._rtRowNumberComma === false ? String(n) : rowNumberGroupFormat.format(n);
}

// 재정렬/필터/페이지 변경 시 Tabulator 는 행 DOM 을 이동만 하고 rowHeader formatter 를 재실행하지 않아
// 순번이 이전 값(행을 따라다님)으로 남는다. 보이는 행들의 rowHeader 숫자를 현재 표시 순서에 맞게 다시 쓴다.
function refreshRowNumbers(instance: any) {
	const visibleRows: any[] = instance.getRows?.("visible") ?? [];
	if (!visibleRows.length) {
		return;
	}

	const updateRow = (row: any) => {
		const el: HTMLElement | null | undefined = row.getElement?.()?.querySelector?.(".tabulator-row-header");
		if (el) {
			el.textContent = formatRowNumber(computeRowNumber(row, instance), instance);
		}
	};

	// 1. 현재 뷰포트에 보이는 행 갱신
	for (const row of visibleRows) {
		updateRow(row);
	}

	// 2/3. 화면 밖 렌더 버퍼(상/하단) 갱신.
	// getPrevRow/getNextRow 는 호출마다 displayRows.indexOf(O(n)) 를 수행해 대량 데이터 하단에서
	// 렌더당 수천만 연산이 되므로, displayRows 인덱스를 1회만 찾아 배열을 직접 걷는다.
	const displayRows: any[] = instance.rowManager?.getDisplayRows?.() ?? [];
	const firstIdx = displayRows.indexOf(visibleRows[0]?._row);
	if (firstIdx < 0) {
		return;
	}
	const lastIdx = displayRows.indexOf(visibleRows[visibleRows.length - 1]?._row, firstIdx);

	// 상단 버퍼 역방향 탐색
	for (let i = firstIdx - 1; i >= 0; i--) {
		const r = displayRows[i];
		if (r?.type !== "row") {
			continue; // 그룹 헤더 등 데이터 행이 아니면 건너뜀
		}
		const e = r.getElement?.();
		if (!e || !e.isConnected) {
			break; // 렌더되지 않은 행을 만나면 탐색 중단
		}
		updateRow(r);
	}

	// 하단 버퍼 정방향 탐색
	for (let i = (lastIdx < 0 ? firstIdx : lastIdx) + 1; i < displayRows.length; i++) {
		const r = displayRows[i];
		if (r?.type !== "row") {
			continue;
		}
		const e = r.getElement?.();
		if (!e || !e.isConnected) {
			break; // 렌더되지 않은 행을 만나면 탐색 중단
		}
		updateRow(r);
	}
}

// ── Tabulator 성능 패치 ─────────────────────────────
// Tabulator 6.5 의 rowManager.getRowFromPosition 은 displayRows 를 앞에서부터 find 하고,
// 각 후보 행의 getPosition()/isDisplayed() 가 다시 includes() 선형 탐색을 수행해 O(n²) 이다.
// range 선택 모듈이 셀 클릭마다 이 함수를 호출(setBounds → layoutRanges → getActiveCell)하므로,
// pagination 없이 대량 데이터를 표시한 상태에서 하단 셀을 클릭하면 프리즈가 발생한다.
// display 순서상 position === index + 1 인 일반 케이스를 O(1) 로 처리하고, 어긋나는 경우
// (그룹 헤더 행이 끼어 있는 등)에만 원본 구현으로 폴백한다.
function patchGetRowFromPosition(instance: any) {
	const rowManager = instance?.rowManager;
	if (!rowManager?.getRowFromPosition) {
		return;
	}
	const original = rowManager.getRowFromPosition.bind(rowManager);
	rowManager.getRowFromPosition = (position: number) => {
		const rows: any[] = rowManager.getDisplayRows?.() ?? [];
		const candidate = rows[position - 1];
		if (candidate && candidate.type === "row" && candidate.position === position) {
			return candidate;
		}
		return original(position);
	};
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

// Alt+클릭 시 해당 컬럼 전체(현재 표시 셀 범위) 선택
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
	// 헤더 클릭으로 컬럼 전체가 선택되는 기본 동작을 끔 (대신 Alt+클릭으로 선택)
	selectableRangeColumns: false,
	selectableRangeRows: true,
	// 기본 range 생성 시 첫 셀로 포커스가 튀는 현상 방지 (실제 클릭 셀 포커스는 cellClick 이 처리)
	selectableRangeAutoFocus: false,
	// 네이티브 정렬은 아이콘 클릭 시에만. 헤더 본문 클릭 정렬은 headerClick 에서 수동 처리(더블클릭과 분리).
	headerSortClickElement: "icon",
	// 정렬 아이콘을 방향이 명확한 화살표로 교체 (테이블 옵션 - 컬럼/columnDefaults 아님)
	headerSortElement: (_column: any, dir: string) => sortIconHtml(dir),
	// editor 셀은 단일 클릭으로 편집되지 않고, 더블클릭으로만 편집 모드 진입.
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
		formatter: (cell: any) => formatRowNumber(computeRowNumber(cell.getRow(), cell.getTable()), cell.getTable()),
		headerSort: false,
		hozAlign: "center",
		resizable: false,
		frozen: true,
		width: 60,
		minWidth: 40,
		widthGrow: 0,
		// 순번 자릿수 정렬: 현재 폰트를 유지한 채 숫자만 등폭(tabular-nums).
		// 완전한 고정폭 폰트를 원하면 options.rowHeader 병합으로 cssClass: "rt-mono" 지정.
		cssClass: "rt-tabular-nums",
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
 * @zh Tabulator(바닐라 JS)를 감싼 React 래퍼 — 코어(MIT).
 *     - 최초 1회만 인스턴스를 생성하고, 데이터/컬럼 변경 시 updateData/replaceData/setColumns 로 증분 갱신합니다.
 *     - 네이티브 기능(정렬/필터/편집/페이지/range/클립보드/persistence)의 옵션 전달과
 *       React 통합·행번호·성능 패치·다국어 인프라를 담당합니다.
 *     - 툴바/트랜잭션/애니메이션 등 확장 기능은 pro 패키지가 onInstance/onBeforeDataUpdate/onAfterDataUpdate
 *       확장 훅으로 부착합니다.
 * @en A React wrapper around Tabulator (vanilla JS) — core (MIT).
 */
function ReactTabulatorCore(props: ReactTabulatorCoreProps) {
	const {
		idField,
		columns,
		data,
		options,
		events,
		className,
		style,
		onRef,
		rowNumber = true,
		autoSelectFirstCell = false,
		locale,
		onInstance,
		onBeforeDataUpdate,
		onAfterDataUpdate,
	} = props;

	if (!idField) {
		throw new Error("[ReactTabulator] 'idField' prop은 필수입니다. 데이터의 고유 식별자 키를 명시해주세요.");
	}

	const domRef = useRef<HTMLDivElement>(null);
	const instanceRef = useRef<any>(null);
	const builtRef = useRef(false);
	const reactId = useId().replace(/:/g, "");

	const indexFieldRef = useRef<string>(idField);
	indexFieldRef.current = idField;
	// 직전(마지막으로 렌더된) 데이터 (증분 diff 용)
	const prevDataRef = useRef<any[]>(data ?? []);
	// 확장 훅 최신값 참조용 ref
	const onBeforeDataUpdateRef = useRef(onBeforeDataUpdate);
	onBeforeDataUpdateRef.current = onBeforeDataUpdate;
	const onAfterDataUpdateRef = useRef(onAfterDataUpdate);
	onAfterDataUpdateRef.current = onAfterDataUpdate;

	// 최초 1회: Tabulator 인스턴스 생성
	useEffect(() => {
		let destroyed = false;

		const build = async () => {
			const el = domRef.current;
			if (!el) {
				return;
			}
			const propOptions = await propsToOptions(props);

			// paginationSizeSelector 의 -1 을 Tabulator 네이티브 "전체"(true) 옵션으로 매핑 (AG Grid 관례 호환).
			// true 선택 시 한 페이지에 전체 행이 표시되며, 라벨은 locale 사전의 pagination.all 을 따른다.
			const sizeSelector = Array.isArray(options?.paginationSizeSelector)
				? options.paginationSizeSelector.map((v: any) => (v === -1 ? true : v))
				: undefined;

			// rowHeader: 기본 정의(전체 순번 formatter 등)를 유지한 채 options.rowHeader 로
			// 일부 속성만 덮어쓸 수 있게 깊은 병합. rowNumber=false 또는 rowHeader:false 면 숨김.
			let rowNumberComma = true;
			let rowHeader: any = !rowNumber || options?.rowHeader === false
				? false
				: typeof options?.rowHeader === "object"
					? { ...DEFAULT_OPTIONS.rowHeader, ...options.rowHeader }
					: DEFAULT_OPTIONS.rowHeader;
			// 순번 3자리 구분자 옵션(thousandsSeparator, 기본 on)은 커스텀 키라서
			// Tabulator 컬럼 정의로 넘기기 전에 분리한다 (미지정 시 on).
			if (rowHeader && typeof rowHeader === "object" && "thousandsSeparator" in rowHeader) {
				const { thousandsSeparator, ...rest } = rowHeader;
				rowNumberComma = thousandsSeparator !== false;
				rowHeader = rest;
			}

			const instance = new Tabulator(el, {
				columns,
				data: data ?? [],
				index: idField,
				...DEFAULT_OPTIONS,
				...propOptions,
				...options,
				...(sizeSelector ? { paginationSizeSelector: sizeSelector } : {}),
				rowHeader,
				// 다국어: 코어 기본 사전(ko 코어 번역) 위에 상위(pro/사용자) langs 를 깊은 병합. locale prop 우선.
				langs: mergeLangs(CORE_LANGS, options?.langs),
				locale: locale ?? options?.locale ?? false,
			});

			// StrictMode 등으로 마운트 도중 언마운트된 경우 방금 만든 인스턴스를 정리합니다.
			if (destroyed) {
				try {
					instance.destroy();
				}
				catch {}
				return;
			}

			// 순번 3자리 구분자 플래그 (formatter/refreshRowNumbers 가 인스턴스에서 읽음)
			(instance as any)._rtRowNumberComma = rowNumberComma;

			// 대량 데이터에서 하단 셀 클릭 시 프리즈를 유발하는 코어 O(n²) 탐색을 O(1) 로 패치
			patchGetRowFromPosition(instance);

			instance.on("tableBuilt", () => {
				builtRef.current = true;
				// 스크롤 점프 시 전체 재렌더(빈 화면) 빈도 완화: 세로 렌더 버퍼를 뷰포트의 2배로 확장.
				// Tabulator 기본값은 뷰포트 1배 — 버퍼×2 를 넘는 점프마다 행 전체를 파기/재생성한다.
				// 사용자가 options.renderVerticalBuffer 를 지정했으면 그 값을 존중한다.
				if (options?.renderVerticalBuffer == null) {
					const holder: HTMLElement | undefined = (instance as any).rowManager?.element;
					const h = holder?.clientHeight;
					if (h) {
						(instance as any).options.renderVerticalBuffer = h * 2;
						try {
							(instance as any).rowManager?.renderer?.resize?.();
						}
						catch {}
					}
				}
			});

			// 최초 렌더링 시 자동 선택(포커스) 해제용 플래그
			let initialClearDone = false;

			// 렌더 완료 후: (1) 파기된 reactFormatter root 정리, (2) rowHeader 순번 재매김,
			//   (3) 최초 렌더링 시 첫 셀 자동 선택 방지 옵션 처리.
			instance.on("renderComplete", () => {
				sweepReactRoots();
				refreshRowNumbers(instance);
				if (!initialClearDone && !autoSelectFirstCell) {
					initialClearDone = true;
					// UI 업데이트 이후에 range가 생성될 수 있으므로 setTimeout으로 지연 해제
					setTimeout(() => {
						try {
							(instance as any).clearRange?.();
						}
						catch {}
					}, 0);
				}
			});
			// editor 로 값이 수정된 셀을 표시합니다. 초기값과 비교해 변경 시 클래스 부여, 되돌리면 제거.
			instance.on("cellEdited", (cell: any) => {
				const changed = cell.getValue() !== cell.getInitialValue();
				cell.getElement()?.classList.toggle("tabulator-cell-edited", changed);
			});
			if (events) {
				Object.entries(events).forEach(([eventName, handler]) => {
					instance.on(eventName as any, handler as any);
				});
			}
			instanceRef.current = instance;
			// 확장 포인트: tableBuilt 이벤트 발생 전이므로 리스너 부착에 안전
			onInstance?.(instance);
			if (onRef) {
				onRef({ current: instance });
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

	// locale prop 변경 시 런타임 전환. 코어 문자열은 Tabulator 내부 binding 이 갱신하고,
	// 확장(pro) 문자열은 localized 이벤트를 구독한 쪽이 갱신한다. (초기 locale 은 생성 옵션으로 전달됨)
	useEffect(() => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current || locale === undefined) {
			return;
		}
		try {
			instance.setLocale(locale);
		}
		catch {}
	}, [locale]);

	// 데이터 변경 처리: 행 집합/순서가 같으면 updateData(변경 필드만) 로 증분 갱신,
	// 다르면(추가/삭제/재정렬) replaceData 로 전체 교체. → 안 바뀐 셀 재렌더/깜박임 방지.
	// 프로그램적 재정렬 중에는 instance._rtProgrammaticSort 플래그를 세워, 확장(pro)의
	// dataSorting 기반 애니메이션과 이중 실행되지 않게 한다.
	const runDataUpdate = (next: any[]) => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current) {
			return;
		}
		const idxF = indexFieldRef.current;
		const prev = prevDataRef.current;

		let sameRowSet = prev.length > 0 && prev.length === next.length;
		if (sameRowSet) {
			for (let i = 0; i < prev.length; i++) {
				if (prev[i]?.[idxF] !== next[i]?.[idxF]) {
					sameRowSet = false;
					break;
				}
			}
		}

		const finish = (token: any, changedFields?: Set<string>) => {
			onAfterDataUpdateRef.current?.({ next, prev, instance, sameRowSet, changedFields, token });
			// updateData 등 부분 갱신 시 renderComplete 이벤트가 발생하지 않을 수 있으므로,
			// 갱신 직후 수동으로 끊긴 DOM(React Root)을 강제 정리해 메모리 누수를 막는다.
			sweepReactRoots();
		};

		if (sameRowSet) {
			// 증분 갱신: 변경된 필드만 updateData → 나머지 셀(코드 컬럼 등)은 재렌더되지 않음
			const updates: any[] = [];
			const changedFields = new Set<string>();
			for (let i = 0; i < next.length; i++) {
				const row = next[i];
				const old = prev[i];
				if (!old) {
					continue;
				}
				const fields = diffRowFields(old, row);
				const keys = Object.keys(fields);
				if (keys.length) {
					updates.push({ [idxF]: row[idxF], ...fields });
					keys.forEach(k => changedFields.add(k));
				}
			}
			if (updates.length) {
				const token = onBeforeDataUpdateRef.current?.({ next, prev, instance, sameRowSet });
				// 변경 행들을 배열 하나로 묶어 updateData 1회만 호출 (행별 병렬 호출 아님 → 재렌더 1패스).
				instance.updateData(updates).then(() => {
					// 갱신된 값이 정렬 순서/현재 페이지에 반영되도록 활성 정렬을 재적용한다.
					// (정렬 중인 필드가 바뀐 경우에만 → 불필요한 전체 재렌더 방지)
					(instance as any)._rtProgrammaticSort = true;
					reapplyActiveSort(instance, changedFields);
					(instance as any)._rtProgrammaticSort = false;
					finish(token, changedFields);
				}).catch(() => {});
			}
		}
		else {
			// 행 집합/순서 변경 → 전체 교체.
			// replaceData 는 내부적으로 정렬을 재적용하며 dataSorting 을 발생시키므로, 이중 방지 플래그를 건다.
			const token = onBeforeDataUpdateRef.current?.({ next, prev, instance, sameRowSet });
			(instance as any)._rtProgrammaticSort = true;
			instance.replaceData(next).then(() => {
				(instance as any)._rtProgrammaticSort = false;
				finish(token);
			}).catch(() => {
				(instance as any)._rtProgrammaticSort = false;
			});
		}
		prevDataRef.current = next;
	};
	const runDataUpdateRef = useRef(runDataUpdate);
	runDataUpdateRef.current = runDataUpdate;

	// data prop 변경을 감지해 갱신을 실행 (coalescing 등 배칭은 상위(pro)에서 처리)
	useEffect(() => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current) {
			return;
		}
		runDataUpdateRef.current(data ?? []);
	}, [data]);

	// 컬럼 변경: setColumns 로 갱신 (columns 는 호출부에서 useMemo 로 안정화 권장)
	useEffect(() => {
		const instance = instanceRef.current;
		if (!instance || !builtRef.current) {
			return;
		}
		instance.setColumns(columns ?? []);
	}, [columns]);

	return (
		<div ref={domRef} id={reactId} className={className} style={{ height: "100%", minHeight: 0, ...style }} />
	);
}

export default ReactTabulatorCore;
