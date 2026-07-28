// SPDX-License-Identifier: MIT
// 변경 셀 플래시 강조 (flashOnChange). 숫자 증가=up(초록), 감소·비숫자=down(빨강).

export interface FlashCell { row: any, field: string, variant: "up" | "down" }

// flash 클래스 제거 (setTimeout args 로 전달)
function removeFlash(el: HTMLElement, variant: string) {
	el.classList.remove("rt-cell-flash", `rt-cell-flash-${variant}`);
	el.style.removeProperty("--rt-flash-dur");
}

// 두 행의 값 diff 중 flash 대상만 추출. 배열/객체 필드는 스킵(코어의 필드 diff 규칙과 동일).
export function diffRowFlash(oldRow: any, newRow: any): FlashCell[] {
	const flash: FlashCell[] = [];
	for (const field of Object.keys(newRow)) {
		const a = oldRow[field];
		const b = newRow[field];
		if (a === b || Array.isArray(a) || Array.isArray(b) || typeof a === "object" || typeof b === "object") {
			continue;
		}
		flash.push({ row: newRow, field, variant: (typeof a === "number" && typeof b === "number" && b > a) ? "up" : "down" });
	}
	return flash;
}

/**
 * 갱신 전/후 데이터에서 flash 대상 셀 목록을 계산한다.
 * 행 집합이 같으면(sameRowSet) 위치 기준, 다르면 id(indexField) 매칭 기준으로 diff.
 */
export function computeFlashCells(prev: any[], next: any[], indexField: string, sameRowSet: boolean): FlashCell[] {
	const flash: FlashCell[] = [];
	if (sameRowSet) {
		for (let i = 0; i < next.length; i++) {
			const old = prev[i];
			if (old) {
				flash.push(...diffRowFlash(old, next[i]));
			}
		}
	}
	else {
		const prevMap = new Map(prev.map(r => [r?.[indexField], r]));
		for (const row of next) {
			const old = prevMap.get(row?.[indexField]);
			if (old) {
				flash.push(...diffRowFlash(old, row));
			}
		}
	}
	return flash;
}

// 주어진 셀 목록에 flash 애니메이션 적용 (변경 셀만)
export function flashCells(instance: any, cells: FlashCell[], indexField: string, duration: number) {
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
