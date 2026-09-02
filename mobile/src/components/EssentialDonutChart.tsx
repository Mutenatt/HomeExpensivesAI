import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, spacing, typography } from "../theme";

interface Props {
  totalEssential: number;
  totalNonEssential: number;
}

const SIZE = 160;
const STROKE_WIDTH = 20;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function EssentialDonutChart({ totalEssential, totalNonEssential }: Props) {
  const total = totalEssential + totalNonEssential;
  const essentialFraction = total > 0 ? totalEssential / total : 0;
  const essentialLength = essentialFraction * CIRCUMFERENCE;
  const essentialPct = Math.round(essentialFraction * 100);
  const nonEssentialPct = total > 0 ? 100 - essentialPct : 0;

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
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.essential}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={`${essentialLength} ${CIRCUMFERENCE}`}
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
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendAmount}>
        ${amount.toFixed(2)} · {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", gap: spacing.md },
  legend: { width: "100%", gap: spacing.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },
  legendAmount: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "600" },
});
