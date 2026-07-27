// SPDX-License-Identifier: PolyForm-Small-Business-1.0.0 OR LicenseRef-Commercial
/**
 * @zh canvas 기반 경량 스파크 차트(bar / line) formatter 팩토리.
 *     React/차트 라이브러리 무의존 — 셀당 canvas 하나만 생성해 즉시 draw 하므로 대량 행에서도 비용이 낮습니다.
 *     Tabulator 의 `formatter` 로 바로 넘길 수 있는 함수를 반환합니다.
 * @en Factory for a lightweight canvas-based spark chart (bar / line) formatter.
 *     No React/chart-lib dependency — one canvas per cell, drawn immediately, so it stays cheap for large tables.
 *     Returns a function you can pass straight to a Tabulator column's `formatter`.
 *
 * @example
 * import { createSparkChartFormatter } from "#src/components/react-tabulator";
 *
 * const columns = [
 *   // 기본: 막대
 *   { title: "추이", field: "trend", formatter: createSparkChartFormatter() },
 *   // 라인(sparkline) + 영역 채우기 + 마지막 값 강조
 *   {
 *     title: "매출", field: "sales",
 *     formatter: createSparkChartFormatter({ type: "line", fill: true, showDots: true }),
 *   },
 * ];
 */

/** @zh 색 결정 함수: 값·인덱스·전체 배열을 받아 CSS 색 문자열 반환 */
export type SparkChartColorFn = (value: number, index: number, values: number[]) => string;
/** @deprecated {@link SparkChartColorFn} 로 대체됨 (하위호환 별칭) */
export type SparkBarColorFn = SparkChartColorFn;

export interface SparkChartOptions {
	/**
	 * @zh 차트 종류. "bar"(막대) 또는 "line"(라인/sparkline).
	 * @en Chart kind: "bar" or "line" (sparkline).
	 * @default "bar"
	 */
	type?: "bar" | "line"
	/**
	 * @zh 셀에서 숫자 배열을 꺼내는 접근자. 필드가 이미 `number[]` 면 정의 불필요.
	 * @en Extracts the numeric array from the cell. Omit if the field is already a `number[]`.
	 * @default cell => cell.getValue() ?? []
	 */
	accessor?: (cell: any) => number[]
	/**
	 * @zh canvas CSS 폭(px). 컬럼 폭에 맞춰 조정.
	 * @default 90
	 */
	width?: number
	/**
	 * @zh canvas CSS 높이(px). 행 높이에 맞춰 조정.
	 * @default 22
	 */
	height?: number
	/**
	 * @zh 색.
	 *   - bar: 막대 채움색. 정적 문자열 또는 값별 색 함수.
	 *   - line: 선/점 색. 함수를 주면 세그먼트·점마다 색이 달라짐(정적 문자열이면 단색 연속선).
	 * @en Color. For "bar" it's the fill; for "line" it's the stroke/dot color (a function colors per segment/dot).
	 * @default "#1677ff"
	 */
	color?: string | SparkChartColorFn
	/**
	 * @zh 정규화 기준.
	 *   - "auto": 셀별 min~max (행마다 스케일이 달라짐)
	 *   - [min, max]: 고정 도메인 (행 간 높이 비교 가능, 범위 밖 값은 클램프)
	 * @en Normalization domain. "auto" scales per cell; [min, max] fixes it so rows are comparable.
	 * @default "auto"
	 */
	domain?: "auto" | [number, number]
	/**
	 * @zh 위/아래(그리고 line 은 좌/우) 여백(px). 마크가 canvas 가장자리에 붙거나 잘리지 않게 함.
	 * @default 1
	 */
	padding?: number
	/**
	 * @zh 배경(트랙) 색. bar 는 각 막대 슬롯 뒤, line 은 canvas 전체 배경. 미지정이면 배경 없음.
	 * @en Track/background color. Behind each bar slot for "bar"; full-canvas background for "line".
	 */
	trackColor?: string

	// ── bar 전용 ────────────────────────────────────────────
	/**
	 * @zh [bar] 막대 사이 간격(px).
	 * @default 1
	 */
	gap?: number
	/**
	 * @zh [bar] 최소 막대 높이(px). 최솟값 막대도 최소 이 높이로 보이게 함. 0 이면 최솟값 막대가 사라짐.
	 * @default 1
	 */
	minBarHeight?: number

	// ── line 전용 ───────────────────────────────────────────
	/**
	 * @zh [line] 선 두께(px).
	 * @default 1.5
	 */
	lineWidth?: number
	/**
	 * @zh [line] 선 아래 영역 채우기. `true` 면 선 색을 옅게(alpha 0.15) 채움, 문자열이면 그 색으로 채움.
	 * @en [line] Area fill under the line. `true` = line color at 0.15 alpha; a string = that fill color.
	 * @default false
	 */
	fill?: boolean | string
	/**
	 * @zh [line] 각 데이터 점에 원(dot) 표시.
	 * @default false
	 */
	showDots?: boolean
	/**
	 * @zh [line] dot 반지름(px). `showDots` 가 true 일 때만 사용.
	 * @default 1.5
	 */
	dotRadius?: number
}

/** @deprecated {@link SparkChartOptions} 로 대체됨 (하위호환 별칭, bar 전용 옵션 집합) */
export type SparkBarOptions = Omit<SparkChartOptions, "type">;

/**
 * @zh 스파크 차트 formatter 를 생성합니다. 반환값을 Tabulator 컬럼의 `formatter` 로 넘기세요.
 * @en Creates a spark-chart formatter. Pass the returned function to a Tabulator column's `formatter`.
 */
export function createSparkChartFormatter(options: SparkChartOptions = {}): (cell: any) => HTMLElement {
	const {
		type = "bar",
		accessor = (cell: any) => cell.getValue() ?? [],
		width = 90,
		height = 22,
		color = "#1677ff",
		domain = "auto",
		padding = 1,
		trackColor,
		gap = 1,
		minBarHeight = 1,
		lineWidth = 1.5,
		fill = false,
		showDots = false,
		dotRadius = 1.5,
	} = options;

	const colorFn: SparkChartColorFn = typeof color === "function" ? color : () => color;
	// line 단색/영역 채우기용 대표 색 (color 가 문자열이면 그대로, 함수면 첫 값 기준)
	const baseColor = typeof color === "string" ? color : "#1677ff";

	return function sparkChartFormatter(cell: any): HTMLElement {
		const arr: number[] = accessor(cell) || [];

		// 셀에 이미 만들어 둔 canvas 가 있으면 재사용한다.
		// Tabulator 가 updateData 시 innerHTML 을 비워 querySelector 로는 찾지 못할 수 있으므로,
		// DOM 노드 대신 엘리먼트 객체의 프로퍼티로 캐싱하여 강력하게 재사용(DOM churn/메모리 누수 방지).
		const cellEl: any = cell?.getElement?.();
		const CANVAS_KEY = "__rtSparkCanvas";
		let canvas: HTMLCanvasElement = cellEl?.[CANVAS_KEY];
		if (!canvas) {
			canvas = document.createElement("canvas") as HTMLCanvasElement;
			canvas.className = "rt-sparkchart";
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			canvas.style.verticalAlign = "middle";
			if (cellEl) {
				cellEl[CANVAS_KEY] = canvas;
			}
		}

		// 고해상도(레티나) 대응: 실제 픽셀 버퍼는 dpr 배율로 잡고 ctx 를 스케일
		const dpr = window.devicePixelRatio || 1;
		const pxW = width * dpr;
		const pxH = height * dpr;
		if (canvas.width !== pxW || canvas.height !== pxH) {
			canvas.width = pxW; // 버퍼 크기 지정 시 자동으로 초기화됨
			canvas.height = pxH;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return canvas;
		}
		// 재사용 canvas 는 이전 그림을 지우고 변환을 리셋 후 다시 그린다.
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, pxW, pxH);
		if (!arr.length) {
			return canvas;
		}
		ctx.scale(dpr, dpr);

		// 정규화 도메인
		const min = domain === "auto" ? Math.min(...arr) : domain[0];
		const max = domain === "auto" ? Math.max(...arr) : domain[1];
		const range = max - min || 1;
		// 값 → [0,1] (고정 도메인일 때 범위 밖 값 보호)
		const norm = (v: number) => Math.min(1, Math.max(0, (v - min) / range));

		if (type === "line") {
			drawLine(ctx, arr, norm);
		}
		else {
			drawBars(ctx, arr, norm);
		}
		return canvas;
	};

	// ── bar 렌더 ────────────────────────────────────────────
	function drawBars(ctx: CanvasRenderingContext2D, arr: number[], norm: (v: number) => number) {
		const barW = Math.max(1, (width - gap * (arr.length - 1)) / arr.length);
		const drawH = height - padding * 2;
		for (let i = 0; i < arr.length; i++) {
			const x = i * (barW + gap);
			const barH = Math.max(minBarHeight, norm(arr[i]) * (drawH - minBarHeight) + minBarHeight);
			if (trackColor) {
				ctx.fillStyle = trackColor;
				ctx.fillRect(x, padding, barW, drawH);
			}
			ctx.fillStyle = colorFn(arr[i], i, arr);
			ctx.fillRect(x, height - padding - barH, barW, barH);
		}
	}

	// ── line 렌더 ───────────────────────────────────────────
	function drawLine(ctx: CanvasRenderingContext2D, arr: number[], norm: (v: number) => number) {
		if (trackColor) {
			ctx.fillStyle = trackColor;
			ctx.fillRect(0, 0, width, height);
		}
		// 선/점이 가장자리에서 잘리지 않도록 여백 확보
		const inset = Math.max(padding, lineWidth / 2, showDots ? dotRadius : 0);
		const drawH = height - inset * 2;
		const baseline = height - inset;
		const xAt = (i: number) => (arr.length === 1 ? width / 2 : inset + (i / (arr.length - 1)) * (width - inset * 2));
		const yAt = (i: number) => baseline - norm(arr[i]) * drawH;

		// 영역 채우기
		if (fill && arr.length > 1) {
			ctx.beginPath();
			ctx.moveTo(xAt(0), baseline);
			for (let i = 0; i < arr.length; i++) {
				ctx.lineTo(xAt(i), yAt(i));
			}
			ctx.lineTo(xAt(arr.length - 1), baseline);
			ctx.closePath();
			if (typeof fill === "string") {
				ctx.fillStyle = fill;
				ctx.fill();
			}
			else {
				ctx.globalAlpha = 0.15;
				ctx.fillStyle = baseColor;
				ctx.fill();
				ctx.globalAlpha = 1;
			}
		}

		// 선
		ctx.lineWidth = lineWidth;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		if (arr.length > 1) {
			if (typeof color === "function") {
				// 세그먼트별 색 (시작 점 값 기준)
				for (let i = 1; i < arr.length; i++) {
					ctx.beginPath();
					ctx.moveTo(xAt(i - 1), yAt(i - 1));
					ctx.lineTo(xAt(i), yAt(i));
					ctx.strokeStyle = colorFn(arr[i - 1], i - 1, arr);
					ctx.stroke();
				}
			}
			else {
				ctx.beginPath();
				ctx.moveTo(xAt(0), yAt(0));
				for (let i = 1; i < arr.length; i++) {
					ctx.lineTo(xAt(i), yAt(i));
				}
				ctx.strokeStyle = baseColor;
				ctx.stroke();
			}
		}

		// 점 (길이 1 이면 단독 점이라도 표시)
		if (showDots || arr.length === 1) {
			for (let i = 0; i < arr.length; i++) {
				ctx.beginPath();
				ctx.arc(xAt(i), yAt(i), dotRadius, 0, Math.PI * 2);
				ctx.fillStyle = colorFn(arr[i], i, arr);
				ctx.fill();
			}
		}
	}
}

/**
 * @zh 막대 스파크 차트 formatter (하위호환 편의 함수). 내부적으로 `createSparkChartFormatter({ type: "bar" })` 를 호출합니다.
 * @en Convenience wrapper for a bar spark chart. Delegates to `createSparkChartFormatter({ type: "bar" })`.
 */
export function createSparkBarFormatter(options: SparkBarOptions = {}): (cell: any) => HTMLElement {
	return createSparkChartFormatter({ ...options, type: "bar" });
}
