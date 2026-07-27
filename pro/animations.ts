// SPDX-License-Identifier: PolyForm-Small-Business-1.0.0 OR LicenseRef-Commercial
// 행/열 이동 애니메이션 (FLIP). Tabulator 에 네이티브 옵션이 없어 직접 구현.

// ── 열 표시/숨김 애니메이션 (가로 FLIP) ────────────────────
// 열을 보이거나 숨기면 나머지 열들이 좌우로 밀린다. mutate 전후로 각 열(leaf)의 가로 위치(left)를 재서,
// 밀린 열들의 header + body 셀에 translateX(옛-새)를 걸었다가 0 으로 트랜지션해 부드럽게 슬라이드시킨다.
// (표시/숨김 대상 열 자체는 즉시 나타남/사라짐 — 나머지 열이 자리를 내주며 이동)
// 열 단위(field)로 매칭하므로 셀 엘리먼트가 재생성돼도 안전하고, 같은 열의 셀은 delta 가 동일하다.
export function animateColumnFlip(instance: any, mutate: () => void, duration: number) {
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
// 가상 스크롤 특성상 "갱신 전·후 모두 뷰포트에 보이는 행"만 연출 가능(나머지는 그냥 나타남/사라짐).

// First: 갱신 직전, 현재 보이는 행들의 화면상 top 을 id(index) 별로 기록
export function captureRowTops(instance: any): Map<any, number> {
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
export function playRowFlip(instance: any, firstTops: Map<any, number>, duration: number) {
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
export function playSortFlip(instance: any, firstTops: Map<any, number>, duration: number) {
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
