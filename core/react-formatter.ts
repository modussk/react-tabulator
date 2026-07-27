// SPDX-License-Identifier: MIT
import type { ReactElement } from "react";
import type { Root } from "react-dom/client";

import { cloneElement } from "react";
import { createRoot } from "react-dom/client";

// host(div) 와 root 를 "셀 엘리먼트"에 보관하기 위한 키.
// Tabulator 는 셀(뷰포트 슬롯) 엘리먼트를 재활용하되, 재렌더 시 셀 내용을 비운다(innerHTML 교체).
// 그래서 host 를 querySelector 로 찾으면 매번 없어서 새 root 를 만들게 되고, 이전 root 를 unmount 하지 않으면
// React 가 root(컨테이너에 붙인 delegated 이벤트 리스너 포함)를 계속 유지 → JS heap 은 거의 안 늘지만
// DOM 노드/이벤트 리스너가 단조 증가하는 leak 이 된다.
// → host 참조를 "셀 엘리먼트 프로퍼티"에 저장해 내용이 비워져도 같은 host 를 반환 → root 를 영구 재사용(누수 없음).
const HOST_KEY = "__reactTabulatorHost";
const REACT_ROOT_KEY = "__reactTabulatorRoot";

// 생성된 root 를 host 별로 추적. 셀(슬롯)이 실제로 파기되면 host 가 DOM 에서 끊기는데, 그 root 를 unmount 하지 않으면
// 위와 같은 누수가 된다. sweep 으로 끊긴 host 의 root 를 회수한다(renderComplete 마다 호출).
const liveRoots = new Map<HTMLElement, Root>();

function sweepDeadRoots() {
	for (const [host, root] of liveRoots) {
		if (!host.isConnected) {
			liveRoots.delete(host);
			// ⚠️ unmount 는 반드시 렌더 사이클 밖에서 실행한다.
			// renderComplete(=Tabulator 렌더 도중)에서 동기 unmount 하면 React 19 가
			// "Attempted to synchronously unmount a root while React was already rendering" 로 throw → 정리 실패(누수 지속).
			// setTimeout 으로 지연해 다음 매크로태스크에 안전하게 unmount 한다.
			setTimeout(() => {
				try {
					root.unmount();
					delete (host as any)[REACT_ROOT_KEY];
				}
				catch {}
			}, 0);
		}
	}
}

/**
 * @zh 끊긴(파기된) reactFormatter 셀들의 React root 를 정리(unmount)한다.
 *     ReactTabulator 가 Tabulator `renderComplete` 이벤트마다 호출해 누수를 방지한다.
 * @en Unmounts React roots of destroyed reactFormatter cells. Called on Tabulator `renderComplete`.
 */
export function sweepReactRoots() {
	sweepDeadRoots();
}

/**
 * @zh Tabulator 셀에 React 컴포넌트를 렌더링하기 위한 formatter 헬퍼.
 *     host/root 를 셀 엘리먼트에 저장해 재렌더마다 재사용하므로(새 root 를 만들지 않음),
 *     고빈도 갱신에서도 DOM 노드/이벤트 리스너가 누적되지 않는다.
 * @en Renders a React component inside a Tabulator cell. The host/root is stored on the cell element and reused
 *     across re-renders (no new root per render), so DOM nodes / event listeners do not accumulate on frequent updates.
 *
 * @example
 * { title: "Name", field: "name", formatter: reactFormatter(<MyCell />) }
 */
export function reactFormatter(element: ReactElement) {
	return (cell: any, _formatterParams: any, _onRendered: (callback: () => void) => void): HTMLElement | string => {
		const cellEl: any = cell?.getElement?.();
		// 셀 엘리먼트에 host 를 1회만 만들어 붙이고 계속 재사용(내용이 비워져도 프로퍼티로 참조 유지).
		let host: HTMLElement | undefined = cellEl?.[HOST_KEY];
		if (cellEl && !host) {
			host = document.createElement("div");
			host.className = "tabulator-react-cell";
			cellEl[HOST_KEY] = host;
		}
		if (!host) {
			// cellEl 미준비(희귀): 이번엔 빈 값, 다음 렌더에서 host 생성
			return "";
		}
		const hostEl = host;

		// host 당 root 1회 생성 후 영구 재사용
		let root = (hostEl as any)[REACT_ROOT_KEY] as Root | undefined;
		if (!root) {
			root = createRoot(hostEl);
			(hostEl as any)[REACT_ROOT_KEY] = root;
			liveRoots.set(hostEl, root);
		}
		const theRoot = root;

		const render = () => {
			try {
				// Tabulator 셀에 cell/value/rowData 주입을 위해 cloneElement 사용
				// eslint-disable-next-line react/no-clone-element
				theRoot.render(cloneElement(element, {
					cell,
					value: cell?.getValue?.(),
					rowData: cell?.getData?.(),
				} as any));
			}
			catch {
				// Virtual DOM 처리 중 셀이 이미 파기된 경우 무시
			}
		};
		// Tabulator 의 onRendered 콜백 배열은 재렌더 시 초기화되지 않아 계속 누적되어 메모리 릭(Closure/Listener)을 유발합니다.
		// setTimeout 만으로도 다음 틱에 렌더가 보장되므로 onRendered 를 사용하지 않습니다.
		setTimeout(render, 0);

		return hostEl;
	};
}
