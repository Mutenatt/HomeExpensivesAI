import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import { formatCurrency } from "../lib/format";
import { colors, spacing, typography } from "../theme";

interface Props {
  totalEssential: number;
  totalNonEssential: number;
}

const SIZE = 160;
const STROKE_WIDTH = 20;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function EssentialDonutChart({ totalEssential, totalNonEssential }: Props) {
  const total = totalEssential + totalNonEssential;
  const essentialFraction = total > 0 ? totalEssential / total : 0;
  const essentialPct = Math.round(essentialFraction * 100);
  const nonEssentialPct = total > 0 ? 100 - essentialPct : 0;

  // Crece desde 0 cada vez que cambia la proporción (al entrar a la pantalla,
  // o al cambiar de mes/actualizarse los datos): anima el arco visible en vez
  // de saltar directo al valor final.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(essentialFraction, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [essentialFraction, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${progress.value * CIRCUMFERENCE} ${CIRCUMFERENCE}`,
  }));

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={total > 0 ? colors.nonEssentialSurface : colors.borderSubtle}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {total > 0 && (
          <>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.nonEssential}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={0}
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.essential}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              animatedProps={animatedProps}
              strokeDashoffset={0}
              strokeLinecap="butt"
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </>
        )}
      </Svg>

      <View style={styles.legend}>
        <LegendRow
          color={colors.essential}
          label="Canasta básica"
          amount={totalEssential}
          pct={essentialPct}
        />
        <LegendRow
          color={colors.nonEssential}
          label="No esencial"
          amount={totalNonEssential}
          pct={nonEssentialPct}
        />
      </View>
    </View>
  );
}

function LegendRow({
  color,
  label,
  amount,
  pct,
}: {
  color: string;
  label: string;
  amount: number;
  pct: number;
}) {
  return (
    <View style={styles.legendRow}>
      <View style={styles.legendLabelGroup}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.legendLabel}>{label}</Text>
      </View>
      <Text style={styles.legendAmount}>{formatCurrency(amount)}</Text>
      <Text style={styles.legendPct}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: spacing.md },
  legend: { width: "100%", gap: spacing.sm },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  legendLabelGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.bodySm, color: colors.textPrimary },
  legendAmount: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "600",
    minWidth: 100,
    textAlign: "right",
  },
  legendPct: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "600",
    minWidth: 44,
    textAlign: "right",
  },
});
