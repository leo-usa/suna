import * as React from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useColorScheme } from 'nativewind';
import { cn } from '@/lib/utils';
import { DobbyLogo } from './DobbyLogo';

interface DobbyLoaderProps {
  /**
   * Size preset for the loader
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  /**
   * Custom size in pixels (overrides size preset)
   */
  customSize?: number;
  /**
   * Additional className for the container
   */
  className?: string;
  /**
   * Additional style for the container
   */
  style?: ViewStyle;
  /**
   * Force a specific color (overrides theme)
   * Use 'light' or 'dark' to force a specific theme color
   */
  forceTheme?: 'light' | 'dark';
  /** @deprecated No longer uses Lottie; kept for call-site compatibility */
  speed?: number;
  /** @deprecated No longer uses Lottie; kept for call-site compatibility */
  autoPlay?: boolean;
  /** @deprecated No longer uses Lottie; kept for call-site compatibility */
  loop?: boolean;
  /** @deprecated No longer uses Lottie; kept for call-site compatibility */
  lottieRef?: unknown;
}

const SIZE_MAP = {
  small: 20,
  medium: 40,
  large: 80,
  xlarge: 120,
} as const;

/**
 * DobbyLoader — branded loading indicator using the Dobby mascot (not legacy Kortix Lottie).
 */
export function DobbyLoader({
  size = 'medium',
  customSize,
  className,
  style,
  forceTheme,
}: DobbyLoaderProps) {
  const { colorScheme } = useColorScheme();
  const loaderSize = customSize || SIZE_MAP[size];
  const effectiveTheme = forceTheme || colorScheme;
  const logoColor = effectiveTheme === 'dark' ? 'dark' : 'light';

  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View className={cn('items-center justify-center', className)} style={style}>
      <Animated.View style={animatedStyle}>
        <DobbyLogo variant="symbol" size={loaderSize} color={logoColor} />
      </Animated.View>
    </View>
  );
}
