import type { ReactElement } from "react";

import { cloneElement } from "react";
import { createRoot } from "react-dom/client";

const REACT_ROOT_KEY = "__reactTabulatorRoot";

/**
 * @zh Tabulator 셀에 React 컴포넌트를 렌더링하기 위한 formatter 헬퍼.
 *     React 19 에서 제거된 ReactDOM.render 대신 createRoot 를 사용합니다.
 *     전달한 엘리먼트는 추가 props( cell, value, rowData )를 함께 전달받습니다.
 * @en Formatter helper to render a React component inside a Tabulator cell.
 *     Uses createRoot (React 18/19) instead of the removed ReactDOM.render.
 *     The given element receives extra props: cell, value, rowData.
 *
 * @example
 * { title: "Name", field: "name", formatter: reactFormatter(<MyCell />) }
 */
export function reactFormatter(element: ReactElement) {
	return (cell: any, _formatterParams: any, onRendered: (callback: () => void) => void) => {
		const render = () => {
			try {
				const cellEl: HTMLElement | undefined = cell?.getElement?.();
				const host = cellEl?.querySelector<HTMLElement>(".tabulator-react-cell");
				if (!host) {
					return;
				}
				// 셀 엘리먼트당 root 를 1회만 생성하여 재렌더 시 재사용합니다.
				let root = (host as any)[REACT_ROOT_KEY];
				if (!root) {
					root = createRoot(host);
					(host as any)[REACT_ROOT_KEY] = root;
				}
				// Tabulator 가 만든 셀에 cell/value/rowData 를 주입하기 위해 cloneElement 사용이 필요합니다.
				// eslint-disable-next-line react/no-clone-element
				root.render(cloneElement(element, {
					cell,
					value: cell?.getValue?.(),
					rowData: cell?.getData?.(),
				} as any));
			} catch (e: any) {
				// Tabulator 의 Virtual DOM 처리 중 셀이 이미 파기된 상태에서 접근하면 
				// "Event Target Lookup Error" 가 발생할 수 있습니다. 
				// 이 경우 렌더링을 중단하고 무시합니다.
			}
		};
		// 셀이 DOM 에 마운트된 뒤 렌더링합니다.
		onRendered(render);
		setTimeout(render, 0);
		return "<div class=\"tabulator-react-cell\"></div>";
	};
}
