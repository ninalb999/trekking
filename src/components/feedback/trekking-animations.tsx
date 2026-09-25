import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// The same forest, sage, cream and sand colors used by the route cards.
const colors = {
  forest: '#123f2d', green: '#1f6a43', sage: '#dce8d7', mint: '#dcefe4',
  cream: '#fbfbf7', sand: '#e8d5a4', muted: '#526357', white: '#ffffff',
};

function useMotionAllowed() {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) setReducedMotion(value);
    }).catch(() => { /* Keep a static illustration if the setting is unavailable. */ });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { active = false; motion.remove(); app.remove(); };
  }, []);
  return !reducedMotion && foreground;
}

/** Native SVG artwork: no remote images, GIFs or network access required. */
export function TrailIllustration() {
  return <Svg width="100%" height="100%" viewBox="0 0 240 160" accessible={false}>
    <Circle cx="120" cy="80" r="76" fill={colors.mint} />
    <Circle cx="164" cy="40" r="14" fill={colors.sand} />
    <Path d="M24 115 85 37 137 115Z" fill={colors.sage} />
    <Path d="m69 58 16-21 18 27-18-9-8 9Z" fill={colors.cream} />
    <Path d="m83 119 60-79 72 79Z" fill={colors.green} />
    <Path d="m125 64 18-24 23 27-23-10-9 12Z" fill={colors.cream} />
    <Path d="M21 119q47-22 97-1t103 0v11q-100 36-200 0Z" fill={colors.sage} />
    <Path d="M115 148c-38-20 51-23 25-40-7-5-10-9-3-17" fill="none" stroke={colors.cream} strokeWidth="12" strokeLinecap="round" />
    <Path d="M115 148c-38-20 51-23 25-40-7-5-10-9-3-17" fill="none" stroke={colors.green} strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
    <Path d="M51 121v-18m-13 5 13-29 13 29Z M188 129v-16m-12 4 12-27 12 27Z" fill={colors.forest} stroke={colors.forest} strokeWidth="3" strokeLinejoin="round" />
    <Circle cx="137" cy="87" r="6" fill={colors.sand} stroke={colors.forest} strokeWidth="2" />
  </Svg>;
}

/** Decorative spinner; its parent supplies the accessible label and busy state. */
export function TrailSpinner({ size = 22, light = false }: { size?: number; light?: boolean }) {
  const [progress] = useState(() => new Animated.Value(0));
  const motionAllowed = useMotionAllowed();
  const ink = light ? colors.white : colors.green;
  useEffect(() => {
    progress.setValue(0);
    if (!motionAllowed) return;
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [motionAllowed, progress]);
  return <View style={{ width: size, height: size }} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="16" fill="none" stroke={ink} strokeOpacity={0.2} strokeWidth="3" />
      <Path d="m10 26 7-12 5 8 3-4 6 8Z" fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
    </Svg>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path d="M20 4a16 16 0 0 1 16 16" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <Circle cx="36" cy="20" r="3" fill={light ? colors.white : colors.green} />
      </Svg>
    </Animated.View>
  </View>;
}

export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={[styles.loading, compact && styles.compact]}>
    {!compact && <View style={styles.loadingArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><TrailIllustration /></View>}
    <View style={styles.loadingCaption}><TrailSpinner size={compact ? 24 : 28} /><Text style={styles.loadingText}>{label}</Text></View>
  </View>;
}

/** Mount only after an explicit, successful sign-in, never on token refresh. */
export function LoginWelcome({ onDismiss }: { onDismiss: () => void }) {
  const [entrance] = useState(() => new Animated.Value(1));
  const motionAllowed = useMotionAllowed();
  useEffect(() => {
    if (!motionAllowed) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, motionAllowed]);
  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Screen-reader users dismiss at their own pace.
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
      if (active && !enabled) timeout = setTimeout(onDismiss, 2600);
    }).catch(() => { /* The Continue button remains available. */ });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => {
      if (enabled && timeout) clearTimeout(timeout);
    });
    return () => { active = false; if (timeout) clearTimeout(timeout); subscription.remove(); };
  }, [onDismiss]);
  return <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
    <View style={styles.backdrop}>
      <View style={styles.welcomeCard} accessibilityViewIsModal>
        <View style={styles.welcomeArt} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}><TrailIllustration /></Animated.View>
          <Animated.View style={[styles.check, { opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
            <Svg width={48} height={48} viewBox="0 0 48 48"><Circle cx="24" cy="24" r="22" fill={colors.green} stroke={colors.cream} strokeWidth="3" /><Path d="m14 24 7 7 13-14" fill="none" stroke={colors.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></Svg>
          </Animated.View>
        </View>
        <Text style={styles.eyebrow}>SESIÓN INICIADA</Text>
        <Text accessibilityRole="header" style={styles.welcomeTitle}>¡Tu aventura continúa!</Text>
        <Text style={styles.welcomeCopy}>Todo listo para explorar, caminar y compartir.</Text>
        <Pressable accessibilityRole="button" onPress={onDismiss} style={({ pressed }) => [styles.continueButton, pressed && { opacity: 0.8 }]}><Text style={styles.continueText}>Comenzar a explorar</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
  compact: { padding: 4 }, loadingArt: { width: 168, height: 112 },
  loadingCaption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.muted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(18,63,45,0.38)' },
  welcomeCard: { width: '100%', maxWidth: 360, padding: 24, alignItems: 'center', borderRadius: 28, backgroundColor: colors.cream, gap: 12 },
  welcomeArt: { width: 216, height: 144 }, check: { position: 'absolute', right: 3, bottom: 0 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  welcomeTitle: { color: colors.forest, fontWeight: '800', fontSize: 25, textAlign: 'center' },
  welcomeCopy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  continueButton: { alignSelf: 'stretch', minHeight: 48, padding: 14, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  continueText: { color: colors.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
