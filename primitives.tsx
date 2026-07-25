import type { CSSProperties, ReactElement, ReactNode } from "react";

import { useState } from "react";
import { Popover as TinyPopover } from "react-tiny-popover";

import { defaultTokens as token } from "./tokens";

/**
 * @zh antd UI 컴포넌트(Button/Checkbox/Switch/Divider/Input/Popover) 의존 제거를 위한 경량 로컬 대체 구현.
 *     스타일은 로컬 디자인 토큰(./tokens)으로 맞춰 톤을 유지합니다. (antd 무의존)
 *     Popover 는 zero-dep 라이브러리 react-tiny-popover 를 사용합니다.
 * @en Lightweight local replacements for UI primitives, styled with local design tokens (./tokens). No antd dependency.
 *     Popover uses the zero-dependency react-tiny-popover library.
 */

type Size = "small" | "middle";

// ── Button ──────────────────────────────────────────────
export function Button({ children, icon, onClick, onMouseDown, size = "middle", style }: {
	children?: ReactNode
	icon?: ReactNode
	onClick?: (e: React.MouseEvent) => void
	onMouseDown?: (e: React.MouseEvent) => void
	size?: Size
	style?: CSSProperties
}) {
	const pad = size === "small" ? `0 ${token.paddingXS}px` : `0 ${token.padding}px`;
	const height = size === "small" ? token.controlHeightSM : token.controlHeight;
	return (
		<button
			type="button"
			onClick={onClick}
			onMouseDown={onMouseDown}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: token.marginXXS,
				height,
				padding: pad,
				fontSize: token.fontSize,
				color: token.colorText,
				background: token.colorBgContainer,
				border: `1px solid ${token.colorBorder}`,
				borderRadius: token.borderRadius,
				cursor: "pointer",
				lineHeight: 1,
				...style,
			}}
		>
			{icon}
			{children}
		</button>
	);
}

// ── Divider (수평) ──────────────────────────────────────
export function Divider({ style }: { style?: CSSProperties }) {
	return <div style={{ height: 1, background: token.colorBorderSecondary, margin: `${token.marginXS}px 0`, ...style }} />;
}

// ── Checkbox ────────────────────────────────────────────
export function Checkbox({ checked, indeterminate, onChange, children }: {
	checked?: boolean
	indeterminate?: boolean
	onChange?: (checked: boolean) => void
	children?: ReactNode
}) {
	// indeterminate 는 DOM 속성이라 ref 로 설정
	const setRef = (el: HTMLInputElement | null) => {
		if (el) {
			el.indeterminate = !!indeterminate && !checked;
		}
	};
	return (
		<label style={{ display: "flex", alignItems: "center", gap: token.marginXS, cursor: "pointer", fontSize: token.fontSize, color: token.colorText }}>
			<input
				ref={setRef}
				type="checkbox"
				checked={!!checked}
				onChange={e => onChange?.(e.target.checked)}
				style={{ accentColor: token.colorPrimary, width: 14, height: 14, cursor: "pointer" }}
			/>
			<span>{children}</span>
		</label>
	);
}

// ── Switch ──────────────────────────────────────────────
export function Switch({ checked, onChange }: {
	checked?: boolean
	onChange?: (checked: boolean) => void
}) {
	const width = 28;
	const height = 16;
	const knob = height - 4;
	return (
		<button
			type="button"
			role="switch"
			aria-checked={!!checked}
			onClick={() => onChange?.(!checked)}
			style={{
				position: "relative",
				width,
				height,
				padding: 0,
				border: "none",
				borderRadius: height,
				background: checked ? token.colorPrimary : token.colorTextQuaternary,
				cursor: "pointer",
				transition: `background ${token.motionDurationMid} ease`,
				flex: "none",
			}}
		>
			<span
				style={{
					position: "absolute",
					top: 2,
					left: checked ? width - knob - 2 : 2,
					width: knob,
					height: knob,
					borderRadius: "50%",
					background: token.colorBgContainer,
					transition: `left ${token.motionDurationMid} ease`,
				}}
			/>
		</button>
	);
}

// ── Input (prefix + clear) ──────────────────────────────
export function Input({ value, onChange, placeholder, prefix, allowClear, size = "middle", style }: {
	value?: string
	onChange?: (value: string) => void
	placeholder?: string
	prefix?: ReactNode
	allowClear?: boolean
	size?: Size
	style?: CSSProperties
}) {
	const height = size === "small" ? token.controlHeightSM : token.controlHeight;
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: token.marginXXS,
				height,
				padding: `0 ${token.paddingSM}px`,
				background: token.colorBgContainer,
				border: `1px solid ${token.colorBorder}`,
				borderRadius: token.borderRadius,
				color: token.colorText,
				...style,
			}}
		>
			{prefix && <span style={{ color: token.colorTextTertiary, display: "inline-flex" }}>{prefix}</span>}
			<input
				value={value ?? ""}
				placeholder={placeholder}
				onChange={e => onChange?.(e.target.value)}
				style={{
					flex: 1,
					minWidth: 0,
					border: "none",
					outline: "none",
					background: "transparent",
					color: "inherit",
					fontSize: token.fontSize,
					padding: 0,
				}}
			/>
			{allowClear && value
				? (
					<span
						role="button"
						aria-label="clear"
						onClick={() => onChange?.("")}
						style={{ cursor: "pointer", color: token.colorTextQuaternary, fontSize: token.fontSize, lineHeight: 1 }}
					>
						✕
					</span>
				)
				: null}
		</span>
	);
}

// ── Popover (react-tiny-popover 기반) ───────────────────
export function Popover({ children, content, title, placement = "bottomRight", onOpenChange }: {
	children: ReactElement
	content: ReactNode
	title?: ReactNode
	placement?: "bottomLeft" | "bottomRight" | "topLeft" | "topRight"
	onOpenChange?: (open: boolean) => void
}) {
	const [open, setOpen] = useState(false);

	const change = (next: boolean) => {
		setOpen(next);
		onOpenChange?.(next);
	};

	const positions: ("top" | "bottom")[] = placement.startsWith("top") ? ["top", "bottom"] : ["bottom", "top"];
	const align: "start" | "end" = placement.endsWith("Right") ? "end" : "start";

	return (
		<TinyPopover
			isOpen={open}
			positions={positions}
			align={align}
			padding={token.marginXXS}
			onClickOutside={() => change(false)}
			content={(
				<div
					style={{
						background: token.colorBgElevated,
						border: `1px solid ${token.colorBorderSecondary}`,
						borderRadius: token.borderRadiusLG,
						boxShadow: token.boxShadowSecondary,
						padding: token.paddingSM,
						color: token.colorText,
						fontSize: token.fontSize,
					}}
				>
					{title && <div style={{ fontWeight: token.fontWeightStrong ?? 600, marginBottom: token.marginXS }}>{title}</div>}
					{content}
				</div>
			)}
		>
			<span style={{ display: "inline-flex" }} onClick={() => change(!open)}>
				{children}
			</span>
		</TinyPopover>
	);
}
