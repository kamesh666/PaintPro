import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../constants/colors";
import {
  useAddClientPayment,
  useClientPayments,
  useClients,
  useDeleteClientPayment,
  useProjectPaymentSummary,
  useProjects,
} from "../hooks/useSupabase";
import { formatCurrency, formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

const PAYMENT_MODES = [
  { key: "cash", label: "💵 Cash", color: "#D1FAE5", text: "#065F46" },
  { key: "upi", label: "📱 UPI", color: "#DBEAFE", text: "#1E40AF" },
  { key: "bank", label: "🏦 Bank", color: "#EDE9FE", text: "#5B21B6" },
  { key: "cheque", label: "📄 Cheque", color: "#FEF3C7", text: "#92400E" },
  { key: "other", label: "💳 Other", color: "#F1F5F9", text: "#475569" },
];

function ModeBadge({ mode }) {
  const m = PAYMENT_MODES.find((p) => p.key === mode) ?? PAYMENT_MODES[4];
  return (
    <View style={[styles.modeBadge, { backgroundColor: m.color }]}>
      <Text style={[styles.modeBadgeText, { color: m.text }]}>{m.label}</Text>
    </View>
  );
}

// ─── Receipt HTML Generator ───────────────────────────────
const generateReceiptHTML = (payment, project, client) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 40px; color: #1A1A2E; }
  .header { text-align: center; margin-bottom: 30px; }
  .brand  { font-size: 28px; font-weight: 900; color: #1E3A5F; }
  .receipt-title { font-size: 18px; color: #6B7280; margin-top: 4px; letter-spacing: 2px; text-transform: uppercase; }
  .divider { height: 3px; background: #1E3A5F; margin: 20px 0; border-radius: 2px; }
  .receipt-no { text-align: right; font-size: 13px; color: #6B7280; margin-bottom: 20px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .party-label { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
  .party-name { font-size: 17px; font-weight: 700; color: #1A1A2E; }
  .party-info { font-size: 12px; color: #6B7280; margin-top: 3px; }
  .amount-box { background: #1E3A5F; color: white; border-radius: 14px; padding: 24px; text-align: center; margin: 24px 0; }
  .amount-label { font-size: 13px; opacity: 0.8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .amount-value { font-size: 42px; font-weight: 900; }
  .details { border: 1px solid #E0E0E0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
  .detail-row { display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #F0F0F0; }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { font-size: 13px; color: #6B7280; }
  .detail-value { font-size: 13px; font-weight: 700; color: #1A1A2E; }
  .balance-box { background: #FEF2F2; border-radius: 10px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center; }
  .balance-label { font-size: 14px; color: #991B1B; font-weight: 600; }
  .balance-value { font-size: 18px; font-weight: 900; color: #DC2626; }
  .paid-stamp  { color: #065F46; font-size: 20px; font-weight: 900; text-align: center; margin: 16px 0; border: 3px solid #065F46; padding: 8px; border-radius: 8px; display: inline-block; }
  .footer { text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E0E0E0; padding-top: 16px; margin-top: 24px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">🎨 PaintPro</div>
    <div class="receipt-title">Payment Receipt</div>
  </div>
  <div class="divider"></div>
  <div class="receipt-no">Receipt Date: ${formatDate(payment.payment_date)}</div>

  <div class="parties">
    <div>
      <div class="party-label">Received from</div>
      <div class="party-name">${client?.name ?? "Client"}</div>
      <div class="party-info">${client?.phone ?? ""}</div>
    </div>
    <div style="text-align:right">
      <div class="party-label">Project</div>
      <div class="party-name">${project?.title ?? "—"}</div>
      <div class="party-info">${project?.location ?? ""}</div>
    </div>
  </div>

  <div class="amount-box">
    <div class="amount-label">Amount received</div>
    <div class="amount-value">${formatCurrency(payment.amount)}</div>
  </div>

  <div class="details">
    <div class="detail-row">
      <span class="detail-label">Payment mode</span>
      <span class="detail-value">${PAYMENT_MODES.find((m) => m.key === payment.payment_mode)?.label ?? payment.payment_mode}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Payment date</span>
      <span class="detail-value">${formatDate(payment.payment_date)}</span>
    </div>
    ${
      payment.reference_no
        ? `
    <div class="detail-row">
      <span class="detail-label">Reference no.</span>
      <span class="detail-value">${payment.reference_no}</span>
    </div>`
        : ""
    }
    <div class="detail-row">
      <span class="detail-label">Contract value</span>
      <span class="detail-value">${formatCurrency(project?.total_value)}</span>
    </div>
  </div>

  ${payment.notes ? `<div style="background:#F5F6FA;border-radius:8px;padding:12px;font-size:12px;color:#6B7280;margin-bottom:16px"><strong>Notes:</strong> ${payment.notes}</div>` : ""}

  <div class="footer">
    Thank you for your payment! · PaintPro Business Tracker · ${new Date().toLocaleDateString("en-IN")}
  </div>
</body>
</html>`;

// ─── Payslip HTML Generator ───────────────────────────────
const generatePayslipHTML = (worker, sheets, month) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 36px; color: #1A1A2E; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .brand  { font-size: 24px; font-weight: 900; color: #1E3A5F; }
  .slip-title { font-size: 14px; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-top: 3px; }
  .divider { height: 3px; background: #1E3A5F; margin: 16px 0; border-radius: 2px; }
  .worker-info { background: #F8FAFC; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; }
  .w-name  { font-size: 20px; font-weight: 800; color: #1A1A2E; margin-bottom: 4px; }
  .w-skill { font-size: 12px; color: #6B7280; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #1E3A5F; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  td { padding: 8px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; }
  .days-row td { display: flex; gap: 4px; flex-wrap: wrap; }
  .day-chip { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .d-full { background: #D1FAE5; color: #065F46; }
  .d-half { background: #FEF3C7; color: #92400E; }
  .d-one  { background: #DBEAFE; color: #1E40AF; }
  .d-abs  { background: #F3F4F6; color: #9CA3AF; }
  .summary { border: 1px solid #E0E0E0; border-radius: 10px; overflow: hidden; }
  .sum-row { display: flex; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #F0F0F0; }
  .sum-row:last-child { border-bottom: none; }
  .sum-label { color: #6B7280; }
  .sum-value { font-weight: 700; }
  .net-pay { background: #1E3A5F; color: white; border-radius: 10px; padding: 16px; text-align: center; margin-top: 16px; }
  .net-label { font-size: 12px; opacity: 0.8; margin-bottom: 4px; }
  .net-value { font-size: 28px; font-weight: 900; }
  .footer { text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E0E0E0; padding-top: 14px; margin-top: 20px; }
</style>
</head>
<body>
  <div class="header">
    <div><div class="brand">🎨 PaintPro</div><div class="slip-title">Salary Slip</div></div>
    <div style="text-align:right"><div style="font-size:14px;font-weight:700">${month}</div><div style="font-size:11px;color:#6B7280">Pay period</div></div>
  </div>
  <div class="divider"></div>

  <div class="worker-info">
    <div>
      <div class="w-name">${worker.name}</div>
      <div class="w-skill">${worker.skill_type ?? "Worker"} · ₹${worker.daily_rate}/day</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#6B7280">Generated</div>
      <div style="font-size:12px;font-weight:600">${new Date().toLocaleDateString("en-IN")}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Week</th><th>Project</th><th style="text-align:center">Days</th><th style="text-align:right">Earned</th><th style="text-align:right">Advance</th><th style="text-align:right">Balance</th></tr></thead>
    <tbody>
      ${sheets
        .map(
          (s) => `
        <tr>
          <td>${formatDate(s.week_start)}</td>
          <td>${s.project_title ?? "—"}</td>
          <td style="text-align:center">${s.total_days}</td>
          <td style="text-align:right">${formatCurrency(s.gross_amount)}</td>
          <td style="text-align:right">${formatCurrency(s.advance_paid)}</td>
          <td style="text-align:right;color:${(s.balance_due ?? 0) > 0 ? "#DC2626" : "#065F46"}">${formatCurrency(Math.abs(s.balance_due ?? 0))}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>

  <div class="summary">
    <div class="sum-row"><span class="sum-label">Total days worked</span><span class="sum-value">${sheets.reduce((s, sh) => s + Number(sh.total_days || 0), 0)}</span></div>
    <div class="sum-row"><span class="sum-label">Total earned</span><span class="sum-value">${formatCurrency(sheets.reduce((s, sh) => s + Number(sh.gross_amount || 0), 0))}</span></div>
    <div class="sum-row"><span class="sum-label">Total advance paid</span><span class="sum-value">${formatCurrency(sheets.reduce((s, sh) => s + Number(sh.advance_paid || 0), 0))}</span></div>
  </div>

  <div class="net-pay">
    <div class="net-label">Net balance due</div>
    <div class="net-value">${formatCurrency(sheets.reduce((s, sh) => s + Number(sh.balance_due || 0), 0))}</div>
  </div>

  <div class="footer">PaintPro Business Tracker · Salary Slip · ${month}</div>
</body>
</html>`;

// ─── Add Payment Modal ────────────────────────────────────
function PaymentModal({ visible, onClose, projectId }) {
  const addPayment = useAddClientPayment();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const profile = useAuthStore((s) => s.profile);

  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [mode, setMode] = useState("cash");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");
  const [selProject, setSelProject] = useState(projectId ?? "");
  const [saving, setSaving] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount("");
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setMode("cash");
      setRefNo("");
      setNotes("");
      setSelProject(projectId ?? "");
      setProjectOpen(false);
    }
  }, [visible, projectId]);

  const selectedProject = projects?.find((p) => p.id === selProject);
  const selectedClient = clients?.find(
    (c) => c.id === selectedProject?.client_id,
  );

  const handleSave = async () => {
    if (!selProject) {
      Alert.alert("Required", "Select a project");
      return;
    }
    if (!amount) {
      Alert.alert("Required", "Enter payment amount");
      return;
    }
    setSaving(true);
    try {
      await addPayment.mutateAsync({
        project_id: selProject,
        client_id: selectedProject?.client_id,
        amount: parseFloat(amount),
        payment_date: paymentDate,
        payment_mode: mode,
        reference_no: refNo || null,
        notes: notes || null,
        created_by: profile?.id,
      });
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Record payment</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.modalBody}
          keyboardShouldPersistTaps="handled"
        >
          {!projectId && (
            <>
              <Text style={LabelStyles}>Project *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setProjectOpen(!projectOpen)}
              >
                <Text
                  style={
                    selectedProject
                      ? styles.pickerValue
                      : styles.pickerPlaceholder
                  }
                >
                  {selectedProject?.title ?? "Select project"}
                </Text>
                <Text style={styles.pickerArrow}>
                  {projectOpen ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>
              {projectOpen && (
                <View style={styles.dropdown}>
                  {(projects ?? []).map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.dropItem,
                        selProject === p.id && styles.dropItemActive,
                      ]}
                      onPress={() => {
                        setSelProject(p.id);
                        setProjectOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropText,
                          selProject === p.id && {
                            color: Colors.primary,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {p.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {selectedClient && (
            <View style={styles.clientInfo}>
              <Text style={styles.clientInfoName}>
                👤 {selectedClient.name}
              </Text>
              {selectedClient.phone ? (
                <Text style={styles.clientInfoPhone}>
                  📞 {selectedClient.phone}
                </Text>
              ) : null}
            </View>
          )}

          <Text style={LabelStyles}>Amount received (₹) *</Text>
          <TextInput
            style={[
              InputStyles,
              { fontSize: 22, fontWeight: "800", color: Colors.primary },
            ]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            underlineColorAndroid="transparent"
          />

          <Text style={LabelStyles}>Payment mode</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PAYMENT_MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.modeChip,
                  mode === m.key && {
                    backgroundColor: m.color,
                    borderColor: m.text + "44",
                  },
                ]}
                onPress={() => setMode(m.key)}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    mode === m.key && { color: m.text, fontWeight: "700" },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Payment date</Text>
              <TextInput
                style={InputStyles}
                value={paymentDate}
                onChangeText={setPaymentDate}
                keyboardType="numbers-and-punctuation"
                underlineColorAndroid="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Reference no.</Text>
              <TextInput
                style={InputStyles}
                value={refNo}
                onChangeText={setRefNo}
                placeholder="UPI/Cheque no."
                placeholderTextColor="#9CA3AF"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <Text style={LabelStyles}>Notes</Text>
          <TextInput
            style={[InputStyles, { height: 72, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any notes..."
            placeholderTextColor="#9CA3AF"
            multiline
            underlineColorAndroid="transparent"
          />

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function ClientPaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projectId = params.projectId ?? null;
  const projectTitle = params.projectTitle ?? "All Projects";

  const [selProject, setSelProject] = useState(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const { data: projects } = useProjects();
  const {
    data: payments,
    isLoading,
    refetch,
    isRefetching,
  } = useClientPayments(selProject);
  const { data: summary } = useProjectPaymentSummary(selProject);
  const deletePayment = useDeleteClientPayment();

  const totalReceived = (payments ?? []).reduce(
    (s, p) => s + Number(p.amount || 0),
    0,
  );

  const handleDelete = (payment) => {
    Alert.alert("Delete", "Remove this payment record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deletePayment.mutate({
            id: payment.id,
            projectId: payment.project_id,
          }),
      },
    ]);
  };

  const handlePrintReceipt = async (payment) => {
    try {
      const project = projects?.find((p) => p.id === payment.project_id);
      const html = generateReceiptHTML(payment, project, {
        name: payment.clients?.name,
        phone: "",
      });
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Payment Receipt",
      });
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Client Payments</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {projectTitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setModalOpen(true)}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {!projectId && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, marginBottom: 8 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <TouchableOpacity
            style={[styles.chip, !selProject && styles.chipActive]}
            onPress={() => setSelProject(null)}
          >
            <Text
              style={[styles.chipText, !selProject && styles.chipTextActive]}
            >
              All
            </Text>
          </TouchableOpacity>
          {(projects ?? []).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, selProject === p.id && styles.chipActive]}
              onPress={() => setSelProject(p.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selProject === p.id && styles.chipTextActive,
                ]}
                numberOfLines={1}
              >
                {p.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Summary */}
      {summary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Contract value</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                {formatCurrency(summary.total_value)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Received</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                {formatCurrency(summary.total_received)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Balance due</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      summary.balance_due > 0 ? Colors.danger : Colors.success,
                  },
                ]}
              >
                {formatCurrency(summary.balance_due)}
              </Text>
            </View>
          </View>
          {summary.total_value > 0 && (
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min((summary.total_received / summary.total_value) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
          )}
          <Text style={styles.progressLabel}>
            {summary.total_value > 0
              ? `${((summary.total_received / summary.total_value) * 100).toFixed(1)}% collected`
              : "No contract value set"}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : !(payments ?? []).length ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>💰</Text>
          <Text style={styles.emptyTitle}>No payments recorded</Text>
          <Text style={styles.emptyMsg}>
            Track payments received from clients
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setModalOpen(true)}
          >
            <Text style={styles.emptyBtnText}>Record first payment</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.payCard}>
              <View style={styles.payTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payAmount}>
                    {formatCurrency(item.amount)}
                  </Text>
                  <Text style={styles.payProject} numberOfLines={1}>
                    {item.projects?.title ?? "Unknown project"}
                  </Text>
                  <Text style={styles.payDate}>
                    📅 {formatDate(item.payment_date)}
                  </Text>
                  {item.reference_no ? (
                    <Text style={styles.payRef}>Ref: {item.reference_no}</Text>
                  ) : null}
                  {item.notes ? (
                    <Text style={styles.payNotes}>{item.notes}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <ModeBadge mode={item.payment_mode} />
                  <TouchableOpacity
                    style={styles.receiptBtn}
                    onPress={() => handlePrintReceipt(item)}
                  >
                    <Text style={styles.receiptBtnText}>🖨 Receipt</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 0,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <PaymentModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        projectId={selProject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 48,
    gap: 10,
  },
  backBtn: { padding: 4 },
  backText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    elevation: 2,
  },
  summaryRow: { flexDirection: "row", marginBottom: 10 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: "800" },
  summaryDivider: { width: 0.5, backgroundColor: "#E0E0E0" },
  progressBar: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: { height: 8, backgroundColor: Colors.success, borderRadius: 4 },
  progressLabel: { fontSize: 11, color: Colors.textMuted, textAlign: "right" },
  payCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  payTop: { flexDirection: "row", gap: 10 },
  payAmount: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.success,
    marginBottom: 4,
  },
  payProject: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  payDate: { fontSize: 12, color: Colors.textMuted, marginBottom: 1 },
  payRef: { fontSize: 11, color: Colors.info },
  payNotes: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  modeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  modeBadgeText: { fontSize: 11, fontWeight: "600" },
  receiptBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  receiptBtnText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 16 },
  clientInfo: {
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    gap: 12,
  },
  clientInfoName: { fontSize: 14, fontWeight: "700", color: "#1A1A2E" },
  clientInfoPhone: { fontSize: 12, color: Colors.textSecondary },
  skeleton: {
    height: 100,
    backgroundColor: "#E0E0E0",
    borderRadius: 14,
    opacity: 0.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 8,
  },
  emptyMsg: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modeChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
  },
  modalClose: { padding: 4, width: 32 },
  closeText: { fontSize: 18, color: Colors.textSecondary },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalBody: { flex: 1, padding: 16 },
  picker: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerValue: { fontSize: 15, color: "#1A1A2E" },
  pickerPlaceholder: { fontSize: 15, color: "#9CA3AF" },
  pickerArrow: { fontSize: 12, color: Colors.textMuted },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  dropItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  dropItemActive: { backgroundColor: "#EFF6FF" },
  dropText: { fontSize: 15, color: "#1A1A2E" },
});
