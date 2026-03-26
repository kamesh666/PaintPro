import { useRouter } from "expo-router";
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
import { Colors, Spacing } from "../../constants/colors";
import { InputStyles, LabelStyles } from "../../constants/theme";
import {
  useAddLabourLog,
  useLabourLogs,
  useMarkLabourPaid,
  useProjects,
  useUpsertWorker,
  useWorkers,
} from "../../hooks/useSupabase";
import { formatCurrency, formatDate, SKILL_TYPE_LABELS } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";

const SKILL_COLORS = {
  painter: { bg: "#E6F1FB", text: "#0C447C", dot: "#2980B9" },
  helper: { bg: "#E1F5EE", text: "#085041", dot: "#27AE60" },
  supervisor: { bg: "#FAEEDA", text: "#633806", dot: "#F39C12" },
};

const INPUT = {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 10,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
  color: "#1A1A2E",
};

function SkillBadge({ skill }) {
  const s = SKILL_COLORS[skill] ?? SKILL_COLORS.painter;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <View style={[styles.dot, { backgroundColor: s.dot, marginRight: 4 }]} />
      <Text style={[styles.badgeText, { color: s.text }]}>
        {SKILL_TYPE_LABELS[skill] ?? skill}
      </Text>
    </View>
  );
}

// ─── Worker Modal ─────────────────────────────────────────
function WorkerModal({ visible, onClose, worker }) {
  const upsert = useUpsertWorker();
  const profile = useAuthStore((s) => s.profile);
  const isEdit = !!worker?.id;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillType, setSkillType] = useState("painter");
  const [dailyRate, setDailyRate] = useState("");
  const [saving, setSaving] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);

  // ✅ Reset form when modal opens or worker changes
  useEffect(() => {
    if (visible) {
      setName(worker?.name ?? "");
      setPhone(worker?.phone ?? "");
      setSkillType(worker?.skill_type ?? "painter");
      setDailyRate(worker?.daily_rate?.toString() ?? "");
      setSkillOpen(false);
    }
  }, [visible, worker]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Worker name is required");
      return;
    }
    if (!dailyRate) {
      Alert.alert("Required", "Daily rate is required");
      return;
    }
    setSaving(true);
    try {
      await upsert.mutateAsync({
        ...(isEdit ? { id: worker.id } : {}),
        name: name.trim(),
        phone: phone.trim(),
        skill_type: skillType,
        daily_rate: parseFloat(dailyRate) || 0,
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
          <Text style={styles.modalTitle}>
            {isEdit ? "Edit worker" : "Add worker"}
          </Text>
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
          <Text style={LabelStyles}>Worker name *</Text>
          <TextInput
            style={InputStyles}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Ravi Kumar"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            underlineColorAndroid="transparent"
          />

          <Text style={LabelStyles}>Phone number</Text>
          <TextInput
            style={InputStyles}
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 9876543210"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            underlineColorAndroid="transparent"
          />

          <Text style={styles.label}>Skill type</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setSkillOpen(!skillOpen)}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: SKILL_COLORS[skillType]?.dot,
                    marginRight: 8,
                  },
                ]}
              />
              <Text style={styles.pickerValue}>
                {SKILL_TYPE_LABELS[skillType]}
              </Text>
            </View>
            <Text style={styles.pickerArrow}>{skillOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {skillOpen && (
            <View style={styles.dropdown}>
              {Object.entries(SKILL_TYPE_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dropItem,
                    skillType === key && styles.dropItemActive,
                  ]}
                  onPress={() => {
                    setSkillType(key);
                    setSkillOpen(false);
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: SKILL_COLORS[key]?.dot },
                      ]}
                    />
                    <Text
                      style={[
                        styles.dropText,
                        skillType === key && {
                          color: Colors.primary,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={LabelStyles}>Daily rate (₹) *</Text>
          <TextInput
            style={InputStyles}
            value={dailyRate}
            onChangeText={setDailyRate}
            placeholder="e.g. 700"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            underlineColorAndroid="transparent"
          />

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Log Labour Modal ─────────────────────────────────────
function LogModal({ visible, onClose }) {
  const { data: workers } = useWorkers();
  const { data: projects } = useProjects();
  const addLog = useAddLabourLog();
  const profile = useAuthStore((s) => s.profile);

  const [projectId, setProjectId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [logDate, setLogDate] = useState("");
  const [daysWorked, setDaysWorked] = useState("1");
  const [saving, setSaving] = useState(false);
  const [workerOpen, setWorkerOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  // ✅ Reset form every time modal opens
  useEffect(() => {
    if (visible) {
      setProjectId("");
      setWorkerId("");
      setLogDate(new Date().toISOString().split("T")[0]);
      setDaysWorked("1");
      setWorkerOpen(false);
      setProjectOpen(false);
    }
  }, [visible]);

  const selectedWorker = workers?.find((w) => w.id === workerId);
  const selectedProject = projects?.find((p) => p.id === projectId);
  const amount = selectedWorker
    ? (parseFloat(daysWorked) || 0) * (selectedWorker.daily_rate || 0)
    : 0;

  const handleSave = async () => {
    if (!projectId) {
      Alert.alert("Required", "Please select a project");
      return;
    }
    if (!workerId) {
      Alert.alert("Required", "Please select a worker");
      return;
    }
    setSaving(true);
    try {
      await addLog.mutateAsync({
        project_id: projectId,
        worker_id: workerId,
        log_date: logDate,
        days_worked: parseFloat(daysWorked) || 1,
        daily_rate: selectedWorker?.daily_rate ?? 0,
        logged_by: profile?.id,
      });
      onClose();
    } catch (e) {
      Alert.alert(
        "Error",
        e.message.includes("unique")
          ? "Log already exists for this worker on this date"
          : e.message,
      );
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
          <Text style={styles.modalTitle}>Log labour</Text>
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
          <Text style={styles.label}>Project *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              setProjectOpen(!projectOpen);
              setWorkerOpen(false);
            }}
          >
            <Text
              style={
                selectedProject ? styles.pickerValue : styles.pickerPlaceholder
              }
            >
              {selectedProject?.title ?? "Select project"}
            </Text>
            <Text style={styles.pickerArrow}>{projectOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {projectOpen && (
            <View style={styles.dropdown}>
              {(projects ?? [])
                .filter((p) => p.status === "active")
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.dropItem,
                      projectId === p.id && styles.dropItemActive,
                    ]}
                    onPress={() => {
                      setProjectId(p.id);
                      setProjectOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropText,
                        projectId === p.id && {
                          color: Colors.primary,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {p.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              {!(projects ?? []).filter((p) => p.status === "active")
                .length && (
                <Text style={styles.dropEmpty}>No active projects</Text>
              )}
            </View>
          )}

          <Text style={styles.label}>Worker *</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              setWorkerOpen(!workerOpen);
              setProjectOpen(false);
            }}
          >
            <Text
              style={
                selectedWorker ? styles.pickerValue : styles.pickerPlaceholder
              }
            >
              {selectedWorker
                ? `${selectedWorker.name} · ₹${selectedWorker.daily_rate}/day`
                : "Select worker"}
            </Text>
            <Text style={styles.pickerArrow}>{workerOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {workerOpen && (
            <View style={styles.dropdown}>
              {(workers ?? []).map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[
                    styles.dropItem,
                    workerId === w.id && styles.dropItemActive,
                  ]}
                  onPress={() => {
                    setWorkerId(w.id);
                    setWorkerOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropText,
                      workerId === w.id && {
                        color: Colors.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {w.name}
                  </Text>
                  <Text style={styles.dropSub}>
                    {SKILL_TYPE_LABELS[w.skill_type]} · ₹{w.daily_rate}/day
                  </Text>
                </TouchableOpacity>
              ))}
              {!(workers ?? []).length && (
                <Text style={styles.dropEmpty}>No workers added yet</Text>
              )}
            </View>
          )}

          <Text style={LabelStyles}>Date</Text>
          <TextInput
            style={InputStyles}
            value={logDate}
            onChangeText={setLogDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            underlineColorAndroid="transparent"
          />

          <Text style={styles.label}>Days worked</Text>
          <Text style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>
            Tap to select: Absent=0 · Half=½ · 1 Shift · 1½ Shifts (full day)
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              {
                val: "0",
                label: "Absent",
                bg: "#F3F4F6",
                tc: "#9CA3AF",
                abc: "#E5E7EB",
              },
              {
                val: "0.5",
                label: "½ day",
                bg: "#FEF3C7",
                tc: "#92400E",
                abc: "#FDE68A",
              },
              {
                val: "1",
                label: "1 shift",
                bg: "#DBEAFE",
                tc: "#1E40AF",
                abc: "#BFDBFE",
              },
              {
                val: "1.5",
                label: "1½ shift",
                bg: "#D1FAE5",
                tc: "#065F46",
                abc: "#A7F3D0",
              },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.val}
                style={[
                  styles.dayChip,
                  daysWorked === opt.val && {
                    backgroundColor: opt.bg,
                    borderColor: opt.abc,
                  },
                  { marginRight: 8, marginBottom: 8 },
                ]}
                onPress={() => setDaysWorked(opt.val)}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    daysWorked === opt.val && {
                      color: opt.tc,
                      fontWeight: "800",
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {amount > 0 && (
            <View style={styles.amountPreview}>
              <Text style={styles.amountLabel}>
                Amount to pay (
                {daysWorked === "0"
                  ? "Absent"
                  : daysWorked === "0.5"
                    ? "Half day"
                    : daysWorked === "1"
                      ? "1 shift"
                      : daysWorked === "1.5"
                        ? "1½ shifts"
                        : daysWorked + " shifts"}
                )
              </Text>
              <Text style={styles.amountValue}>{formatCurrency(amount)}</Text>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function LabourScreen() {
  const [tab, setTab] = useState("logs");
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const router = useRouter();
  const {
    data: workers,
    isLoading: wLoading,
    refetch: wRefetch,
    isRefetching: wRefetching,
  } = useWorkers();
  const { data: projects } = useProjects("active");
  const {
    data: logs,
    isLoading: lLoading,
    refetch: lRefetch,
    isRefetching: lRefetching,
  } = useLabourLogs(selectedProject);
  const markPaid = useMarkLabourPaid();

  const handleMarkPaid = (logId) => {
    Alert.alert("Mark as paid", "Confirm payment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: () =>
          markPaid.mutate({ id: logId, projectId: selectedProject }),
      },
    ]);
  };

  const handleBulkMarkPaid = () => {
    const unpaidSelected = Array.from(selectedLogs).filter((logId) => {
      const log = logs.find((l) => l.id === logId);
      return log && !log.is_paid;
    });

    if (unpaidSelected.length === 0) {
      Alert.alert(
        "No unpaid logs selected",
        "Please select unpaid labour logs to mark as paid.",
      );
      return;
    }

    Alert.alert(
      "Mark selected as paid",
      `Mark ${unpaidSelected.length} labour log${unpaidSelected.length > 1 ? "s" : ""} as paid?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              await Promise.all(
                unpaidSelected.map((logId) =>
                  markPaid.mutateAsync({
                    id: logId,
                    projectId: selectedProject,
                  }),
                ),
              );
              setSelectedLogs(new Set());
              setBulkMode(false);
            } catch (e) {
              Alert.alert("Error", "Failed to mark some logs as paid");
            }
          },
        },
      ],
    );
  };

  // Filter logs based on search and date range
  const filteredLogs = (logs ?? []).filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.workers?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDateFrom = !dateFrom || log.log_date >= dateFrom;
    const matchesDateTo = !dateTo || log.log_date <= dateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const totalDue = filteredLogs
    .filter((l) => !l.is_paid)
    .reduce((s, l) => s + Number(l.amount ?? 0), 0);
  const totalPaid = filteredLogs
    .filter((l) => l.is_paid)
    .reduce((s, l) => s + Number(l.amount ?? 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Tab switcher */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          margin: 16,
          marginBottom: 8,
        }}
      >
        <View style={[styles.tabRow, { flex: 1, margin: 0, marginRight: 8 }]}>
          {[
            { key: "logs", label: "📋 Logs" },
            { key: "workers", label: "👷 Workers" },
          ].map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  tab === t.key && styles.tabBtnTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: Colors.accent,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
          }}
          onPress={() => router.push("/weekly-labour")}
          activeOpacity={0.8}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
            📆 Weekly
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── LOGS TAB ── */}
      {tab === "logs" && (
        <View style={{ flex: 1 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 8 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingVertical: 8,
            }}
          >
            <TouchableOpacity
              style={[styles.chip, !selectedProject && styles.chipActive]}
              onPress={() => setSelectedProject(null)}
            >
              <Text
                style={[
                  styles.chipText,
                  !selectedProject && styles.chipTextActive,
                ]}
              >
                All projects
              </Text>
            </TouchableOpacity>
            {(projects ?? []).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  selectedProject === p.id && styles.chipActive,
                ]}
                onPress={() => setSelectedProject(p.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedProject === p.id && styles.chipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {p.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search and Filters */}
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TextInput
                  style={[INPUT, { height: 38, fontSize: 14 }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="🔍 Search worker..."
                  placeholderTextColor="#9CA3AF"
                  underlineColorAndroid="transparent"
                />
              </View>
              <TouchableOpacity
                style={[styles.bulkBtn, bulkMode && styles.bulkBtnActive]}
                onPress={() => {
                  setBulkMode(!bulkMode);
                  setSelectedLogs(new Set());
                }}
              >
                <Text
                  style={[
                    styles.bulkBtnText,
                    bulkMode && styles.bulkBtnTextActive,
                  ]}
                >
                  {bulkMode ? "Cancel" : "Select"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <TextInput
                  style={[INPUT, { height: 36, fontSize: 14 }]}
                  value={dateFrom}
                  onChangeText={setDateFrom}
                  placeholder="From date (YYYY-MM-DD)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                  underlineColorAndroid="transparent"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[INPUT, { height: 36, fontSize: 14 }]}
                  value={dateTo}
                  onChangeText={setDateTo}
                  placeholder="To date (YYYY-MM-DD)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numbers-and-punctuation"
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>

            {bulkMode && selectedLogs.size > 0 && (
              <TouchableOpacity
                style={styles.bulkPayBtn}
                onPress={handleBulkMarkPaid}
              >
                <Text style={styles.bulkPayBtnText}>
                  Mark {selectedLogs.size} Selected as Paid
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredLogs.length > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Unpaid</Text>
                <Text style={[styles.summaryValue, { color: Colors.danger }]}>
                  {formatCurrency(totalDue)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Paid</Text>
                <Text style={[styles.summaryValue, { color: Colors.success }]}>
                  {formatCurrency(totalPaid)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={[styles.summaryValue, { color: Colors.primary }]}>
                  {formatCurrency(totalDue + totalPaid)}
                </Text>
              </View>
            </View>
          )}

          {lLoading ? (
            <View style={{ padding: 16 }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={
                    i < 3
                      ? [styles.skeleton, { marginBottom: 10 }]
                      : styles.skeleton
                  }
                />
              ))}
            </View>
          ) : !filteredLogs.length ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
              <Text style={styles.emptyTitle}>
                {logs?.length
                  ? "No logs match your filters"
                  : "No labour logs yet"}
              </Text>
              <Text style={styles.emptyMsg}>
                {logs?.length
                  ? "Try adjusting your search or date filters"
                  : "Tap + to log daily labour"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredLogs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedLogs.has(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.logCard,
                      item.is_paid && { opacity: 0.65 },
                      bulkMode &&
                        isSelected && {
                          backgroundColor: Colors.primary + "10",
                          borderColor: Colors.primary + "30",
                          borderWidth: 1,
                        },
                    ]}
                    onPress={
                      bulkMode
                        ? () => {
                            const newSelected = new Set(selectedLogs);
                            if (isSelected) {
                              newSelected.delete(item.id);
                            } else {
                              newSelected.add(item.id);
                            }
                            setSelectedLogs(newSelected);
                          }
                        : undefined
                    }
                    activeOpacity={bulkMode ? 0.7 : 1}
                  >
                    {bulkMode && (
                      <View style={styles.selectionIndicator}>
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxSelected,
                          ]}
                        >
                          {isSelected && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logWorker}>
                        {item.workers?.name ?? "Unknown"}
                      </Text>
                      <Text style={styles.logMeta}>
                        {formatDate(item.log_date)} · {item.days_worked} day
                        {item.days_worked !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.logAmount}>
                        {formatCurrency(item.amount)}
                      </Text>
                      {item.is_paid ? (
                        <View style={[styles.paidBadge, { marginTop: 6 }]}>
                          <Text style={styles.paidText}>✓ Paid</Text>
                        </View>
                      ) : bulkMode ? (
                        <Text style={[styles.selectHint, { marginTop: 6 }]}>
                          Tap to select
                        </Text>
                      ) : (
                        <TouchableOpacity
                          style={[styles.payBtn, { marginTop: 6 }]}
                          onPress={() => handleMarkPaid(item.id)}
                        >
                          <Text style={styles.payBtnText}>Mark paid</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{
                padding: 16,
                paddingTop: 0,
                paddingBottom: 100,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={lRefetching}
                  onRefresh={lRefetch}
                  tintColor={Colors.primary}
                />
              }
            />
          )}
        </View>
      )}

      {/* ── WORKERS TAB ── */}
      {tab === "workers" && (
        <View style={{ flex: 1 }}>
          {wLoading ? (
            <View style={{ padding: 16 }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={
                    i < 3
                      ? [styles.skeleton, { marginBottom: 10 }]
                      : styles.skeleton
                  }
                />
              ))}
            </View>
          ) : !(workers ?? []).length ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>👷</Text>
              <Text style={styles.emptyTitle}>No workers yet</Text>
              <Text style={styles.emptyMsg}>
                Tap + to add your first worker
              </Text>
            </View>
          ) : (
            <FlatList
              data={workers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.workerCard}
                  onPress={() => {
                    setSelectedWorker(item);
                    setWorkerModalOpen(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={[styles.workerAvatar, { marginRight: 12 }]}>
                    <Text style={styles.workerAvatarText}>
                      {item.name?.[0]?.toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>{item.name}</Text>
                    <Text style={styles.workerRate}>
                      {formatCurrency(item.daily_rate)}/day
                    </Text>
                  </View>
                  <SkillBadge skill={item.skill_type} />
                </TouchableOpacity>
              )}
              contentContainerStyle={{
                padding: 16,
                paddingTop: 0,
                paddingBottom: 100,
              }}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={wRefetching}
                  onRefresh={wRefetch}
                  tintColor={Colors.primary}
                />
              }
            />
          )}
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          tab === "logs" ? setLogModalOpen(true) : setWorkerModalOpen(true)
        }
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <LogModal visible={logModalOpen} onClose={() => setLogModalOpen(false)} />
      <WorkerModal
        visible={workerModalOpen}
        onClose={() => {
          setWorkerModalOpen(false);
          setSelectedWorker(null);
        }}
        worker={selectedWorker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  tabRow: {
    flexDirection: "row",
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },
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
  summaryRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  summaryValue: { fontSize: 15, fontWeight: "800" },
  summaryDivider: { width: 0.5, backgroundColor: "#E0E0E0" },
  logCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  logWorker: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  logMeta: { fontSize: 12, color: Colors.textMuted },
  logAmount: { fontSize: 15, fontWeight: "800", color: "#1A1A2E" },
  paidBadge: {
    backgroundColor: "#E1F5EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  paidText: { fontSize: 11, color: Colors.success, fontWeight: "700" },
  payBtn: {
    backgroundColor: Colors.primary + "18",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  payBtnText: { fontSize: 12, color: Colors.primary, fontWeight: "700" },
  workerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  workerAvatarText: { fontSize: 17, fontWeight: "700", color: Colors.primary },
  workerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  workerRate: { fontSize: 13, color: Colors.textSecondary },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  dayChip: {
    width: 48,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayChipText: { fontSize: 13, fontWeight: "600", color: Colors.textSecondary },
  amountPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primary + "10",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  amountLabel: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  amountValue: { fontSize: 20, fontWeight: "800", color: Colors.primary },
  skeleton: {
    height: 72,
    backgroundColor: "#E0E0E0",
    borderRadius: 12,
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
  emptyMsg: { fontSize: 15, color: Colors.textSecondary, textAlign: "center" },
  fab: {
    position: "absolute",
    bottom: 80,
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
  dropSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  dropEmpty: {
    padding: 16,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
  bulkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkBtnActive: { backgroundColor: Colors.primary },
  bulkBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  bulkBtnTextActive: { color: "#fff" },
  bulkPayBtn: {
    backgroundColor: Colors.success,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  bulkPayBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  selectionIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "800" },
  selectHint: { fontSize: 11, color: Colors.primary, fontWeight: "600" },
});
