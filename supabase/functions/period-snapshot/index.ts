// Edge Function: period-snapshot
//
// Invocada por pg_cron (ver supabase/migrations/*_schedule_period_snapshots.sql)
// los lunes 8:00 ART (corte semanal) y el día 1 de cada mes 8:00 ART (corte mensual).
//
// Para cada usuario con actividad en el período: calcula totales de ingresos/gastos/
// esenciales, los persiste en period_snapshots y envía una notificación push (Expo)
// si el usuario tiene un token registrado.

import { createClient } from "npm:@supabase/supabase-js@2";

// Argentina no observa horario de verano: UTC-3 fijo.
const ART_OFFSET_HOURS = -3;

type PeriodType = "weekly" | "monthly";

function toArtDate(utcNow: Date): Date {
  return new Date(utcNow.getTime() + ART_OFFSET_HOURS * 60 * 60 * 1000);
}

function computePeriodRange(periodType: PeriodType, utcNow: Date) {
  const artNow = toArtDate(utcNow);
  const artMidnight = new Date(
    Date.UTC(artNow.getUTCFullYear(), artNow.getUTCMonth(), artNow.getUTCDate()),
  );

  if (periodType === "weekly") {
    // artMidnight es el lunes en que corre el cron -> el período cerrado es
    // el lunes anterior (inclusive) al domingo anterior (inclusive).
    const periodEnd = new Date(artMidnight);
    periodEnd.setUTCDate(periodEnd.getUTCDate() - 1); // domingo
    const periodStart = new Date(periodEnd);
    periodStart.setUTCDate(periodStart.getUTCDate() - 6); // lunes
    return { periodStart, periodEnd };
  }

  // monthly: artMidnight es el día 1 -> el período cerrado es el mes calendario anterior.
  const periodEnd = new Date(artMidnight);
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1); // último día del mes anterior
  const periodStart = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));
  return { periodStart, periodEnd };
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function sendExpoPush(tokens: string[], title: string, body: string) {
  if (tokens.length === 0) return;
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body }))),
  });
}

Deno.serve(async (req) => {
  try {
    const { period_type: periodType } = (await req.json()) as { period_type: PeriodType };
    if (periodType !== "weekly" && periodType !== "monthly") {
      return new Response(JSON.stringify({ error: "period_type debe ser 'weekly' o 'monthly'" }), {
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { periodStart, periodEnd } = computePeriodRange(periodType, new Date());
    const periodStartStr = toDateOnly(periodStart);
    // periodEnd es inclusive; el rango de fechas de transactions es exclusivo al final.
    const rangeEndExclusive = new Date(periodEnd);
    rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

    const { data: userIds, error: userIdsError } = await supabase
      .from("transactions")
      .select("user_id")
      .gte("date", periodStart.toISOString())
      .lt("date", rangeEndExclusive.toISOString())
      .is("deleted_at", null);

    if (userIdsError) throw userIdsError;

    const distinctUserIds = [...new Set((userIds ?? []).map((r) => r.user_id as string))];
    const results: Array<{ user_id: string; status: string }> = [];

    for (const userId of distinctUserIds) {
      const { data: rows, error: rowsError } = await supabase
        .from("transactions")
        .select("amount, type, product:products(is_essential)")
        .eq("user_id", userId)
        .gte("date", periodStart.toISOString())
        .lt("date", rangeEndExclusive.toISOString())
        .is("deleted_at", null);

      if (rowsError) {
        results.push({ user_id: userId, status: `error: ${rowsError.message}` });
        continue;
      }

      let totalIncome = 0;
      let totalExpense = 0;
      let totalEssential = 0;

      for (const row of rows ?? []) {
        const amount = Number(row.amount);
        if (row.type === "income") {
          totalIncome += amount;
        } else if (row.type === "expense") {
          totalExpense += amount;
          if ((row.product as { is_essential?: boolean } | null)?.is_essential) {
            totalEssential += amount;
          }
        }
      }

      const { error: upsertError } = await supabase.from("period_snapshots").upsert(
        {
          user_id: userId,
          period_type: periodType,
          period_start: periodStartStr,
          period_end: toDateOnly(periodEnd),
          total_income: totalIncome,
          total_expense: totalExpense,
          total_essential: totalEssential,
        },
        { onConflict: "user_id,period_type,period_start" },
      );

      if (upsertError) {
        results.push({ user_id: userId, status: `error: ${upsertError.message}` });
        continue;
      }

      const { data: tokenRows } = await supabase
        .from("push_tokens")
        .select("expo_push_token")
        .eq("user_id", userId);

      const tokens = (tokenRows ?? []).map((t) => t.expo_push_token as string);
      const label = periodType === "weekly" ? "semanal" : "mensual";
      await sendExpoPush(
        tokens,
        `Cierre ${label} de gastos`,
        `Ingresos: $${totalIncome.toFixed(2)} · Gastos: $${totalExpense.toFixed(2)}`,
      );

      results.push({ user_id: userId, status: "ok" });
    }

    return new Response(JSON.stringify({ periodType, periodStart: periodStartStr, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
