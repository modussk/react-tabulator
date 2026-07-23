# ReactTabulator

[Tabulator](https://tabulator.info) 를 감싼 React 래퍼 컴포넌트. Ant Design 톤 테마, quick filter(Fuse.js),
열 설정(표시/숨김 + localStorage 저장/복원), range 선택/클립보드, 편집 셀 강조 등을 옵션으로 제공합니다.

이 폴더는 **자족적(self-contained)** 이며 다른 React 프로젝트로 폴더째 복사하여 사용할 수 있습니다.
(프로젝트 경로 alias 없이 상대경로/npm 패키지 import 만 사용)

## Peer dependencies

대상 프로젝트에 아래 패키지가 설치되어 있어야 합니다.

```bash
pnpm add react react-dom antd @ant-design/icons ahooks fuse.js tabulator-tables
```

| 패키지 | 용도 |
| --- | --- |
| `react`, `react-dom` | React 18/19 (createRoot, useInsertionEffect 사용) |
| `antd` | 헤더 UI(Input/Popover/Checkbox/Switch/Button) + 디자인 토큰(theme.useToken) |
| `@ant-design/icons` | 검색/설정 아이콘 |
| `ahooks` | quick filter debounce(useDebounceFn) |
| `fuse.js` | quick filter fuzzy 검색 |
| `tabulator-tables` | 테이블 코어 + 기본 CSS |

> 별도의 `ThemeProvider`(react-jss 등) 설정은 필요 없습니다. antd 의 `theme.useToken()` 으로 토큰을 직접 읽습니다.
> 단, antd `ConfigProvider`(다크모드/커스텀 테마)를 쓰는 경우 그 하위에서 사용하세요.

## 사용법

```tsx
import { ReactTabulator, reactFormatter, useAntdTabulatorTheme } from "@/components/tabulator";

function Example({ rows }: { rows: any[] }) {
  const { antdTabulator } = useAntdTabulatorTheme(); // antd 톤 테마 클래스

  const columns = [
    { title: "코드", field: "code", width: 150 },
    { title: "이름", field: "name" },
    { title: "상태", field: "status", editor: "input" }, // 더블클릭/Enter 로 편집
    { title: "숨김열", field: "memo", visible: false },
  ];

  return (
    <ReactTabulator
      className={antdTabulator}
      data={rows}
      columns={columns}
      persistKey="example:columns"                 // 열 가시성/폭/순서 저장 키
      headerToolbar={{ quickFilter: true, columnSetting: true }}
      options={{ layout: "fitDataStretch", height: "400px" }}
    />
  );
}
```

## 주요 Props

| Prop | 타입 | 설명 |
| --- | --- | --- |
| `data` | `any[]` | 행 데이터 (변경 시 `replaceData` 로 증분 갱신) |
| `columns` | `ColumnDefinition[]` | Tabulator 컬럼 정의 (그룹 컬럼 지원) |
| `options` | `object` | Tabulator 옵션 (기본 옵션에 병합) |
| `events` | `Record<string, fn>` | Tabulator 이벤트 핸들러 |
| `className` / `style` | | 컨테이너에 적용 |
| `onRef` | `(ref) => void` | Tabulator 인스턴스 ref 전달 |
| `persistKey` | `string` | 열 가시성/폭/순서를 localStorage 에 저장/복원 |
| `headerToolbar` | `HeaderToolbarConfig` | 상단 header 툴바(미지정 시 미표시) |

### `HeaderToolbarConfig`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `quickFilter` | `boolean \| QuickFilterConfig` | header 왼쪽 검색 입력 (기본 표시). `QuickFilterConfig`: `keys`, `placeholder`, `debounce`, `exact` |
| `columnSetting` | `boolean` | header 오른쪽 내장 열 설정 UI(표시/숨김 + 저장 스위치). 저장 스위치는 `persistKey` 지정 시 표시 |

## 기본 동작 (DEFAULT_OPTIONS)

- 정렬: 아이콘 클릭, 3단계 토글(오름→내림→해제)
- range 선택 + 클립보드 복사/붙여넣기(스프레드시트 방식)
- `editor` 셀은 더블클릭 또는 Enter 로만 편집, 값 변경 시 셀 강조
- 행번호(rowHeader) 전체 순번 표시

![Sample](./img.png)

## 헬퍼

- `reactFormatter(<Cell />)`: Tabulator 셀에 React 컴포넌트를 렌더링하는 formatter. 전달 컴포넌트는 `cell`/`value`/`rowData` props 를 받습니다.
- `useAntdTabulatorTheme()`: antd 톤 테마 클래스명을 반환(`{ antdTabulator }`). `className` 으로 전달해 사용.
