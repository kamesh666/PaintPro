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
import { Colors } from "../../constants/colors";
import {
  useClients,
  useProjects,
  useUpsertProject,
} from "../../hooks/useSupabase";
import {
  formatCurrency,
  formatDate,
  PROJECT_STATUS_LABELS,
} from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";

const STATUS_COLORS = {
  active: { bg: "#E1F5EE", text: "#085041", dot: "#27AE60" },
  paused: { bg: "#FAEEDA", text: "#633806", dot: "#F39C12" },
  completed: { bg: "#E6F1FB", text: "#0C447C", dot: "#2980B9" },
  cancelled: { bg: "#FCEBEB", text: "#791F1F", dot: "#E74C3C" },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.active;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: s.dot }]} />
      <Text style={[styles.badgeText, { color: s.text }]}>
        {PROJECT_STATUS_LABELS[status] ?? status}
      </Text>
    </View>
  );
}

function ProjectCard({
  project,
  onPress,
  onPhotos,
  onMaterials,
  onPayments,
  onQuotation,
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {project.title}
          </Text>
          <Text style={styles.cardClient} numberOfLines={1}>
            {project.clients?.name ?? "No client"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StatusBadge status={project.status} />
          <TouchableOpacity onPress={onPhotos} style={styles.photosBtn}>
            <Text style={styles.photosBtnText}>📷 Photos</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta} numberOfLines={1}>
          📍 {project.location ?? "—"}
        </Text>
        <Text style={styles.cardMeta}>📅 {formatDate(project.start_date)}</Text>
        <Text style={styles.cardValue}>
          {formatCurrency(project.total_value)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ProjectModal({ visible, onClose, project }) {
  const { data: clients } = useClients();
  const upsert = useUpsertProject();
  const profile = useAuthStore((s) => s.profile);
  const isEdit = !!project?.id;

  // ✅ KEY FIX: individual state + useEffect reset
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [totalValue, setTotalValue] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(project?.title ?? "");
      setLocation(project?.location ?? "");
      setDescription(project?.description ?? "");
      setTotalValue(project?.total_value?.toString() ?? "");
      setAdvancePaid(project?.advance_paid?.toString() ?? "");
      setClientId(project?.client_id ?? "");
      setStatus(project?.status ?? "active");
      setStartDate(
        project?.start_date ?? new Date().toISOString().split("T")[0],
      );
      setClientOpen(false);
      setStatusOpen(false);
    }
  }, [visible, project]);

  const selectedClient = clients?.find((c) => c.id === clientId);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Required", "Project title is required");
      return;
    }
    setSaving(true);
    try {
      await upsert.mutateAsync({
        ...(isEdit ? { id: project.id } : {}),
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        total_value: parseFloat(totalValue) || 0,
        advance_paid: parseFloat(advancePaid) || 0,
        client_id: clientId || null,
        status,
        start_date: startDate || null,
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
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEdit ? "Edit project" : "New project"}
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
          showsVerticalScrollIndicator={false}
        >
          <Text style={LabelStyles}>Project title *</Text>
          <TextInput
            style={InputStyles}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 3BHK interior painting"
            placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent"
          />

          <Text style={LabelStyles}>Client</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              setClientOpen(!clientOpen);
              setStatusOpen(false);
            }}
          >
            <Text
              style={clientId ? styles.pickerValue : styles.pickerPlaceholder}
            >
              {selectedClient?.name ?? "Select client"}
            </Text>
            <Text style={styles.pickerArrow}>{clientOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {clientOpen && (
            <View style={styles.dropdown}>
              {(clients ?? []).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.dropItem,
                    clientId === c.id && styles.dropItemActive,
                  ]}
                  onPress={() => {
                    setClientId(c.id);
                    setClientOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropText,
                      clientId === c.id && {
                        color: Colors.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {!clients?.length && (
                <Text style={styles.dropEmpty}>No clients — add one first</Text>
              )}
            </View>
          )}

          <Text style={LabelStyles}>Location</Text>
          <TextInput
            style={InputStyles}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Tiruppur"
            placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent"
          />

          <Text style={LabelStyles}>Status</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              setStatusOpen(!statusOpen);
              setClientOpen(false);
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={[
                  styles.badgeDot,
                  { backgroundColor: STATUS_COLORS[status]?.dot },
                ]}
              />
              <Text style={styles.pickerValue}>
                {PROJECT_STATUS_LABELS[status]}
              </Text>
            </View>
            <Text style={styles.pickerArrow}>{statusOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {statusOpen && (
            <View style={styles.dropdown}>
              {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dropItem,
                    status === key && styles.dropItemActive,
                  ]}
                  onPress={() => {
                    setStatus(key);
                    setStatusOpen(false);
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
                        styles.badgeDot,
                        { backgroundColor: STATUS_COLORS[key]?.dot },
                      ]}
                    />
                    <Text
                      style={[
                        styles.dropText,
                        status === key && {
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

          <Text style={LabelStyles}>Start date (YYYY-MM-DD)</Text>
          <TextInput
            style={InputStyles}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-01-01"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            underlineColorAndroid="transparent"
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Contract value (₹)</Text>
              <TextInput
                style={INPUT}
                value={totalValue}
                onChangeText={setTotalValue}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                underlineColorAndroid="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Advance paid (₹)</Text>
              <TextInput
                style={INPUT}
                value={advancePaid}
                onChangeText={setAdvancePaid}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <Text style={LabelStyles}>Notes</Text>
          <TextInput
            style={[INPUT, { height: 88, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Additional notes..."
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

const FILTERS = [
  { key: null, label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
];

export default function ProjectsScreen() {
  const [filter, setFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const router = useRouter();
  const {
    data: projects,
    isLoading,
    refetch,
    isRefetching,
  } = useProjects(filter);

  const filtered = (projects ?? []).filter(
    (p) =>
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.clients?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => {
    setSelected(null);
    setModalOpen(true);
  };
  const openEdit = (p) => {
    setSelected(p);
    setModalOpen(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search projects..."
          placeholderTextColor="#9CA3AF"
          underlineColorAndroid="transparent"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={{ color: Colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 44, marginBottom: 8 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={String(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.chipText,
                filter === f.key && styles.chipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🏗️</Text>
          <Text style={styles.emptyTitle}>
            {search ? "No projects found" : "No projects yet"}
          </Text>
          <Text style={styles.emptyMsg}>
            {search
              ? "Try a different search"
              : "Tap + to create your first project"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => openEdit(item)}
              onPhotos={() =>
                router.push({
                  pathname: "/site-photos",
                  params: { projectId: item.id, projectTitle: item.title },
                })
              }
              onMaterials={() =>
                router.push({
                  pathname: "/material-costs",
                  params: { projectId: item.id, projectTitle: item.title },
                })
              }
              onPayments={() =>
                router.push({
                  pathname: "/client-payments",
                  params: { projectId: item.id, projectTitle: item.title },
                })
              }
              onQuotation={() =>
                router.push({
                  pathname: "/quotation",
                  params: { projectId: item.id, projectTitle: item.title },
                })
              }
            />
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

      {!isLoading && filtered.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {filtered.length} project{filtered.length !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.summaryValue}>
            Total:{" "}
            {formatCurrency(
              filtered.reduce((s, p) => s + (p.total_value ?? 0), 0),
            )}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={openCreate}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <ProjectModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        project={selected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    height: 46,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: "#1A1A2E" },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  cardClient: { fontSize: 13, color: Colors.textSecondary },
  divider: { height: 0.5, backgroundColor: "#E0E0E0", marginBottom: 10 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardMeta: { fontSize: 11, color: Colors.textMuted, flex: 1 },
  cardValue: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" },
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
  emptyMsg: { fontSize: 15, color: Colors.textSecondary, textAlign: "center" },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#E0E0E0",
  },
  summaryText: { fontSize: 13, color: Colors.textSecondary },
  summaryValue: { fontSize: 13, fontWeight: "700", color: Colors.primary },
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
  cardActions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#F0F0F0",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 0.5,
    borderColor: "#E0E0E0",
  },
  actionBtnText: { fontSize: 13 },
  photosBtn: {
    backgroundColor: Colors.info + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photosBtnText: { fontSize: 11, color: Colors.info, fontWeight: "600" },
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
  modalCloseText: { fontSize: 18, color: Colors.textSecondary },
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
  dropEmpty: {
    padding: 16,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
});
