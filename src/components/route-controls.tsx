import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
export function Input({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#65736a" {...props} style={[ui.input, props.multiline && { height: 90, textAlignVertical: 'top' }, props.style]} /></View>;
}
export function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[ui.action, disabled && { opacity: 0.5 }]}><Text style={ui.actionText}>{label}</Text></Pressable>;
}
export function Choices({ values, selected, onSelect, multiple = false }: { values: string[]; selected: string[]; onSelect: (value: string) => void; multiple?: boolean }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{values.map(value => <Pressable key={value} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected.includes(value) }} onPress={() => onSelect(value)} style={[ui.choice, selected.includes(value) && ui.selected]}><Text style={{ color: '#153e2c' }}>{multiple && (selected.includes(value) ? '✓ ' : '')}{value}</Text></Pressable>)}</View>;
}
export const ui = StyleSheet.create({
  content: { padding: 18, gap: 16 }, title: { fontSize: 26, fontWeight: '700', color: '#123f2d' }, label: { fontSize: 16, fontWeight: '600', color: '#21332a' },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#bbc9c0', borderRadius: 8, padding: 12, fontSize: 16, minHeight: 48, color: '#172c20' },
  action: { backgroundColor: '#1f6a43', borderRadius: 8, padding: 14, minHeight: 48, alignItems: 'center' }, actionText: { color: 'white', fontWeight: '700', fontSize: 16 },
  choice: { padding: 12, borderWidth: 1, borderColor: '#c5d4cb', borderRadius: 8, backgroundColor: 'white' }, selected: { backgroundColor: '#d4eade', borderColor: '#1f6a43' },
  error: { color: '#982a22', fontSize: 14 }, muted: { color: '#526357', lineHeight: 21 },
});
