import { createElement, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type NativeProps = Record<string, any> & { children?: ReactNode; style?: any };

function flattenStyle(style: any): CSSProperties {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce<CSSProperties>((all, item) => ({ ...all, ...flattenStyle(item) }), {});
  const result: Record<string, any> = { ...style };
  const pairs: Array<[string, string]> = [
    ['paddingHorizontal', 'paddingInline'], ['marginHorizontal', 'marginInline'],
    ['paddingVertical', 'paddingBlock'], ['marginVertical', 'marginBlock'],
    ['borderTopLeftRadius', 'borderTopLeftRadius'], ['borderTopRightRadius', 'borderTopRightRadius'],
  ];
  for (const [native, css] of pairs) {
    if (native in result) { result[css] = result[native]; delete result[native]; }
  }
  if ('shadowColor' in result || 'shadowOpacity' in result || 'shadowRadius' in result) {
    const color = result.shadowColor ?? '#000';
    const opacity = result.shadowOpacity ?? .15;
    const radius = result.shadowRadius ?? 8;
    result.boxShadow = `0 2px ${radius}px rgba(0,0,0,${opacity})`;
    delete result.shadowColor; delete result.shadowOpacity; delete result.shadowRadius; delete result.shadowOffset;
  }
  delete result.elevation;
  if (Array.isArray(result.transform)) {
    result.transform = result.transform.map((part: Record<string, number>) => Object.entries(part).map(([key, value]) => {
      if (key === 'translateX' || key === 'translateY') return `${key}(${value}px)`;
      if (key === 'scale') return `scale(${value})`;
      if (key === 'rotate') return `rotate(${value})`;
      return '';
    }).join(' ')).join(' ');
  }
  return result as CSSProperties;
}

function commonStyle(style: any, extra?: CSSProperties): CSSProperties {
  return { ...flattenStyle(style), ...extra };
}

export function View({ children, style, onPress, onLongPress, onLayout, pointerEvents, ...props }: NativeProps) {
  return createElement('div', {
    ...props,
    style: commonStyle(style, pointerEvents === 'none' ? { pointerEvents: 'none' } : undefined),
    onClick: onPress,
    onContextMenu: onLongPress ? (event: React.MouseEvent) => { event.preventDefault(); onLongPress(event); } : undefined,
    onLoad: onLayout,
  }, children);
}

export function Text({ children, style, numberOfLines, onPress, ...props }: NativeProps) {
  const clamp: CSSProperties = numberOfLines ? {
    display: '-webkit-box', WebkitLineClamp: numberOfLines, WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } as CSSProperties : {};
  return createElement('span', { ...props, style: commonStyle(style, clamp), onClick: onPress }, children);
}

export function Pressable({ children, style, onPress, onLongPress, disabled, hitSlop: _hitSlop, android_ripple: _ripple, ...props }: NativeProps) {
  const computed = typeof style === 'function' ? style({ pressed: false }) : style;
  return createElement('button', {
    ...props, type: props.type ?? 'button', disabled, onClick: onPress,
    onContextMenu: onLongPress ? (event: React.MouseEvent) => { event.preventDefault(); onLongPress(event); } : undefined,
    style: commonStyle(computed, { border: 'none', font: 'inherit', textAlign: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer' }),
  }, children);
}

export function TextInput({ style, value, defaultValue, onChangeText, onChange, onSubmitEditing, multiline, numberOfLines, editable, placeholderTextColor, ...props }: NativeProps) {
  const baseStyle = commonStyle(style, { color: style?.color ?? 'inherit', outlineOffset: 2 });
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !multiline && onSubmitEditing) { event.preventDefault(); onSubmitEditing({ nativeEvent: { text: (event.target as HTMLInputElement).value } }); }
    props.onKeyDown?.(event);
  };
  const shared = { ...props, value, defaultValue, readOnly: editable === false, placeholder: props.placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChangeText?.(event.target.value);
      onChange?.(event);
    }, onKeyDown, style: baseStyle };
  return multiline ? createElement('textarea', { ...shared, rows: numberOfLines ?? 3 }) : createElement('input', shared);
}

export function ScrollView({ children, style, contentContainerStyle, horizontal, onScroll, showsVerticalScrollIndicator: _v, showsHorizontalScrollIndicator: _h, keyboardShouldPersistTaps: _k, ...props }: NativeProps) {
  return createElement('div', { ...props, onScroll, style: commonStyle(style, { overflowX: horizontal ? 'auto' : undefined, overflowY: horizontal ? 'hidden' : 'auto', WebkitOverflowScrolling: 'touch' }) },
    createElement('div', { style: commonStyle(contentContainerStyle, horizontal ? { display: 'flex', flexDirection: 'row', width: 'max-content' } : undefined) }, children));
}

export function FlatList({ data = [], renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, contentContainerStyle, horizontal, onEndReached, onEndReachedThreshold: _threshold, refreshing: _refreshing, onRefresh, ...props }: NativeProps) {
  const rows = Array.isArray(data) ? data : [];
  const empty = typeof ListEmptyComponent === 'function' ? createElement(ListEmptyComponent) : ListEmptyComponent;
  const header = typeof ListHeaderComponent === 'function' ? createElement(ListHeaderComponent) : ListHeaderComponent;
  const footer = typeof ListFooterComponent === 'function' ? createElement(ListFooterComponent) : ListFooterComponent;
  return createElement('div', {
    ...props, onScroll: (event: React.UIEvent<HTMLDivElement>) => {
      props.onScroll?.(event);
      const node = event.currentTarget;
      if (onEndReached && node.scrollHeight - node.scrollTop - node.clientHeight < 80) onEndReached();
    },
    style: commonStyle(props.style, { overflowY: horizontal ? 'hidden' : 'auto', overflowX: horizontal ? 'auto' : undefined }),
  }, createElement('div', { style: commonStyle(contentContainerStyle, horizontal ? { display: 'flex', flexDirection: 'row', gap: 8, width: 'max-content' } : undefined) },
    header, rows.length ? rows.map((item: any, index: number) => createElement('div', { key: keyExtractor?.(item, index) ?? item?.id ?? index }, renderItem?.({ item, index }))) : empty, footer));
}

export function ActivityIndicator({ size, color, style, ...props }: NativeProps) {
  const dimensions = size === 'large' ? 30 : 18;
  return createElement('span', { ...props, role: 'status', style: commonStyle(style, { display: 'inline-block', width: dimensions, height: dimensions, borderRadius: '50%', border: `2px solid ${color ?? 'currentColor'}`, borderTopColor: 'transparent', animation: 'spin .8s linear infinite' }) });
}

export function Modal({ visible, children, onRequestClose: _onRequestClose, transparent: _transparent, animationType: _animationType, statusBarTranslucent: _statusBarTranslucent }: NativeProps) {
  if (!visible) return null;
  return createPortal(createElement('div', { className: 'native-modal-portal', style: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' } }, children), document.body);
}

export function RefreshControl(_props: NativeProps) { return null; }
export function Keyboard() { return { dismiss: () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); } }; }
export const Platform = { OS: 'web', select: (values: Record<string, any>) => values.web ?? values.default };
export const Share = { share: async ({ message }: { message: string }) => { if (navigator.share) await navigator.share({ text: message }); else await navigator.clipboard?.writeText(message); } };
export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
  absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as CSSProperties,
  hairlineWidth: 1,
  flatten: flattenStyle,
};
export function useWindowDimensions() {
  return { width: typeof window === 'undefined' ? 1024 : window.innerWidth, height: typeof window === 'undefined' ? 768 : window.innerHeight, scale: 1, fontScale: 1 };
}

export function Picker({ children, selectedValue, onValueChange, style, ...props }: NativeProps) {
  return createElement('select', { ...props, value: selectedValue, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(event.target.value), style: commonStyle(style) }, children);
}
Picker.Item = function PickerItem({ label, value, ...props }: NativeProps) {
  return createElement('option', { ...props, value }, label);
};
