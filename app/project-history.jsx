import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { Colors } from "../constants/colors";
import { useProjectHistory } from "../hooks/useSupabase";
import { formatCurrency, formatDate, PROJECT_STATUS_LABELS } from "../lib/utils";

function Section({ title, count, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {typeof count === "number" ? <Text style={styles.count}>{count}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function EmptyText({ text = "No data" }) {
  return <Text style={styles.emptyText}>{text}</Text>;
}

export default function ProjectHistoryScreen() {
  const router = useRouter();
  const { projectId, projectTitle } = useLocalSearchParams();
  const { data, isLoading, isRefetching, refetch } = useProjectHistory(projectId);

  const totals = useMemo(() => {
    const payments = (data?.payments ?? []).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    const labour = (data?.labourLogs ?? []).reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
    const materials = (data?.materialCosts ?? []).reduce((sum, x) => sum + (Number(x.total_cost) || 0), 0);
    return { payments, labour, materials };
  }, [data]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <Text onPress={() => router.back()} style={styles.back}>← Back</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Project History</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{projectTitle ?? "Project"}</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        >
          <Section title="Overview">
            <View style={styles.overviewGrid}>
              <View style={styles.metric}><Text style={styles.metricLabel}>Status</Text><Text style={styles.metricValue}>{PROJECT_STATUS_LABELS[data?.project?.status] ?? data?.project?.status ?? "-"}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Contract</Text><Text style={styles.metricValue}>{formatCurrency(data?.project?.total_value ?? 0)}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Client paid</Text><Text style={styles.metricValue}>{formatCurrency(totals.payments)}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Spent</Text><Text style={styles.metricValue}>{formatCurrency(totals.materials + totals.labour)}</Text></View>
            </View>
          </Section>

          <Section title="Client Payments" count={data?.payments?.length ?? 0}>
            {(data?.payments?.length ?? 0) === 0 ? <EmptyText /> : data.payments.map((p) => (
              <View key={p.id} style={styles.row}><Text style={styles.rowTitle}>{formatCurrency(p.amount)}</Text><Text style={styles.rowSub}>{formatDate(p.payment_date)} · {p.payment_mode ?? "-"}</Text></View>
            ))}
          </Section>

          <Section title="Material Costs" count={data?.materialCosts?.length ?? 0}>
            {(data?.materialCosts?.length ?? 0) === 0 ? <EmptyText /> : data.materialCosts.map((m) => (
              <View key={m.id} style={styles.row}><Text style={styles.rowTitle}>{m.item_name} · {formatCurrency(m.total_cost)}</Text><Text style={styles.rowSub}>{formatDate(m.purchase_date)} · {m.category ?? "other"}</Text></View>
            ))}
          </Section>

          <Section title="Labour Logs" count={data?.labourLogs?.length ?? 0}>
            {(data?.labourLogs?.length ?? 0) === 0 ? <EmptyText /> : data.labourLogs.map((l) => (
              <View key={l.id} style={styles.row}><Text style={styles.rowTitle}>{l.workers?.name ?? "Worker"} · {formatCurrency(l.amount)}</Text><Text style={styles.rowSub}>{formatDate(l.log_date)} · {l.is_paid ? "Paid" : "Unpaid"}</Text></View>
            ))}
          </Section>

          <Section title="Site Photos" count={data?.photos?.length ?? 0}>
            {(data?.photos?.length ?? 0) === 0 ? <EmptyText /> : data.photos.map((ph) => (
              <View key={ph.id} style={styles.row}><Text style={styles.rowTitle}>{ph.caption?.trim() || "Photo uploaded"}</Text><Text style={styles.rowSub}>{formatDate(ph.uploaded_at)}</Text></View>
            ))}
          </Section>

          <Section title="Quotations" count={data?.quotations?.length ?? 0}>
            {(data?.quotations?.length ?? 0) === 0 ? <EmptyText /> : data.quotations.map((q) => (
              <View key={q.id} style={styles.row}><Text style={styles.rowTitle}>{q.quote_no ?? "Quotation"} · {formatCurrency(q.total_amount)}</Text><Text style={styles.rowSub}>{formatDate(q.quote_date ?? q.created_at)} · {q.status ?? "draft"}</Text></View>
            ))}
          </Section>

          <Section title="Invoices" count={data?.invoices?.length ?? 0}>
            {(data?.invoices?.length ?? 0) === 0 ? <EmptyText /> : data.invoices.map((inv) => (
              <View key={inv.id} style={styles.row}><Text style={styles.rowTitle}>{inv.invoice_no ?? "Invoice"} · {formatCurrency(inv.total)}</Text><Text style={styles.rowSub}>{formatDate(inv.invoice_date ?? inv.created_at)} · {inv.status ?? "draft"}</Text></View>
            ))}
          </Section>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { color: "#fff", fontSize: 15, fontWeight: "700" },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#DDE7F8", marginTop: 2 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A2E" },
  count: { fontSize: 12, color: Colors.textMuted },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { width: "48%", backgroundColor: Colors.background, borderRadius: 8, padding: 10 },
  metricLabel: { fontSize: 12, color: Colors.textMuted },
  metricValue: { fontSize: 14, fontWeight: "700", marginTop: 4, color: "#1A1A2E" },
  row: { borderTopWidth: 0.5, borderTopColor: "#ececec", paddingTop: 10, marginTop: 10 },
  rowTitle: { fontSize: 14, fontWeight: "600", color: "#1A1A2E" },
  rowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  emptyText: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
});
