import { useLocalSearchParams, useRouter } from "expo-router";
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
  useAddMaterialCostFull,
  useDeleteMaterialCost,
  useMaterialCosts,
  useProjects,
  useUpdateMaterialCost,
} from "../hooks/useSupabase";
import { formatCurrency, formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

const CATEGORIES = [
  { key: "paint", label: "🎨 Paint", color: "#DBEAFE", text: "#1E40AF" },
  { key: "primer", label: "🪣 Primer", color: "#EDE9FE", text: "#5B21B6" },
  { key: "tools", label: "🔧 Tools", color: "#FEF3C7", text: "#92400E" },
  { key: "hardware", label: "⚙️ Hardware", color: "#D1FAE5", text: "#065F46" },
  { key: "labour", label: "👷 Labour", color: "#FFE4E6", text: "#9F1239" },
  { key: "other", label: "📦 Other", color: "#F1F5F9", text: "#475569" },
];

const UNITS = ["litre", "kg", "bag", "piece", "box", "roll", "bundle", "other"];

function CatBadge({ category }) {
  const cat = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[5];
  return (
    <View style={[styles.catBadge, { backgroundColor: cat.color }]}>
      <Text style={[styles.catBadgeText, { color: cat.text }]}>
        {cat.label}
      </Text>
    </View>
  );
}

function CostCard({ item, onPress, onDelete }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={ActiveOpacity}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.item_name}</Text>
          {item.vendor_name ? (
            <Text style={styles.cardSub}>🏪 {item.vendor_name}</Text>
          ) : null}
          {item.bill_no ? (
            <Text style={styles.cardSub}>🧾 Bill #{item.bill_no}</Text>
          ) : null}
          <Text style={styles.cardDate}>
            📅 {formatDate(item.purchase_date)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={styles.cardAmount}>
            {formatCurrency(item.total_cost)}
          </Text>
          {item.quantity && item.unit ? (
            <Text style={styles.cardQty}>
              {item.quantity} {item.unit}
            </Text>
          ) : null}
          <CatBadge category={item.category} />
        </View>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)}>
        <Text style={styles.deleteBtnText}>🗑 Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function CostModal({ visible, onClose, cost, projectId }) {
  const addCost = useAddMaterialCostFull();
  const updateCost = useUpdateMaterialCost();
  const profile = useAuthStore((s) => s.profile);
  const { data: projects } = useProjects();
  const isEdit = !!cost?.id;

  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("litre");
  const [unitPrice, setUnitPrice] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [billNo, setBillNo] = useState("");
  const [category, setCategory] = useState("paint");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [selProjectId, setSelProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setItemName(cost?.item_name ?? "");
      setQuantity(cost?.quantity?.toString() ?? "");
      setUnit(cost?.unit ?? "litre");
      setUnitPrice(cost?.unit_price?.toString() ?? "");
      setTotalCost(cost?.total_cost?.toString() ?? "");
      setVendorName(cost?.vendor_name ?? "");
      setBillNo(cost?.bill_no ?? "");
      setCategory(cost?.category ?? "paint");
      setPurchaseDate(
        cost?.purchase_date ?? new Date().toISOString().split("T")[0],
      );
      setSelProjectId(cost?.project_id ?? projectId ?? "");
      setUnitOpen(false);
      setProjectOpen(false);
    }
  }, [visible, cost, projectId]);

  // Auto-calc total when qty × price changes
  useEffect(() => {
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(unitPrice) || 0;
    if (q > 0 && p > 0) setTotalCost((q * p).toFixed(2));
  }, [quantity, unitPrice]);

  const finalTotal =
    parseFloat(totalCost) ||
    (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  const selectedProject = projects?.find((p) => p.id === selProjectId);

  const handleSave = async () => {
    if (!itemName.trim()) {
      Alert.alert("Required", "Item name is required");
      return;
    }
    if (!selProjectId) {
      Alert.alert("Required", "Please select a project");
      return;
    }
    if (!finalTotal) {
      Alert.alert("Required", "Enter total cost");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        item_name: itemName.trim(),
        quantity: parseFloat(quantity) || null,
        unit: unit || null,
        unit_price: parseFloat(unitPrice) || null,
        total_cost: finalTotal,
        vendor_name: vendorName.trim() || null,
        bill_no: billNo.trim() || null,
        category,
        purchase_date: purchaseDate,
        project_id: selProjectId,
        added_by: profile?.id,
      };
      if (isEdit) await updateCost.mutateAsync({ ...payload, id: cost.id });
      else await addCost.mutateAsync(payload);
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
            {isEdit ? "Edit cost" : "Add material cost"}
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
          {/* Category selector */}
          <Text style={LabelStyles}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 4 }}
          >
            <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.catChip,
                    category === cat.key && {
                      backgroundColor: cat.color,
                      borderColor: cat.text + "44",
                    },
                  ]}
                  onPress={() => setCategory(cat.key)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      category === cat.key && {
                        color: cat.text,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Project */}
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
                        selProjectId === p.id && styles.dropItemActive,
                      ]}
                      onPress={() => {
                        setSelProjectId(p.id);
                        setProjectOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropText,
                          selProjectId === p.id && {
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

          <Text style={LabelStyles}>Item name *</Text>
          <TextInput
            style={InputStyles}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Asian Paints Apex Emulsion"
            placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent"
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Quantity</Text>
              <TextInput
                style={InputStyles}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="e.g. 10"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                underlineColorAndroid="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Unit</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setUnitOpen(!unitOpen)}
              >
                <Text style={styles.pickerValue}>{unit}</Text>
                <Text style={styles.pickerArrow}>{unitOpen ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {unitOpen && (
                <View style={styles.dropdown}>
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[
                        styles.dropItem,
                        unit === u && styles.dropItemActive,
                      ]}
                      onPress={() => {
                        setUnit(u);
                        setUnitOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropText,
                          unit === u && {
                            color: Colors.primary,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Unit price (₹)</Text>
              <TextInput
                style={InputStyles}
                value={unitPrice}
                onChangeText={setUnitPrice}
                placeholder="per unit"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                underlineColorAndroid="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Total cost (₹) *</Text>
              <TextInput
                style={[
                  InputStyles,
                  { color: Colors.primary, fontWeight: "700" },
                ]}
                value={totalCost}
                onChangeText={setTotalCost}
                placeholder="auto-calculated"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <Text style={LabelStyles}>Vendor / Shop name</Text>
          <TextInput
            style={InputStyles}
            value={vendorName}
            onChangeText={setVendorName}
            placeholder="e.g. Raj Paints Store"
            placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent"
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Bill number</Text>
              <TextInput
                style={InputStyles}
                value={billNo}
                onChangeText={setBillNo}
                placeholder="e.g. INV-123"
                placeholderTextColor="#9CA3AF"
                underlineColorAndroid="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Purchase date</Text>
              <TextInput
                style={InputStyles}
                value={purchaseDate}
                onChangeText={setPurchaseDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          {finalTotal > 0 && (
            <View style={styles.totalPreview}>
              <Text style={styles.totalPreviewLabel}>Total cost</Text>
              <Text style={styles.totalPreviewValue}>
                {formatCurrency(finalTotal)}
              </Text>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function MaterialCostsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { data: projects } = useProjects();

  const projectId = params.projectId ?? null;
  const projectTitle = params.projectTitle ?? "All Projects";

  const [selProject, setSelProject] = useState(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const {
    data: costs,
    isLoading,
    refetch,
    isRefetching,
  } = useMaterialCosts(selProject);
  const deleteCost = useDeleteMaterialCost();

  const handleDelete = (item) => {
    Alert.alert("Delete", `Remove "${item.item_name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteCost.mutate({ id: item.id, projectId: item.project_id }),
      },
    ]);
  };

  const totalCost = (costs ?? []).reduce(
    (s, c) => s + Number(c.total_cost || 0),
    0,
  );

  const byCat = CATEGORIES.map((cat) => ({
    ...cat,
    total: (costs ?? [])
      .filter((c) => c.category === cat.key)
      .reduce((s, c) => s + Number(c.total_cost || 0), 0),
  })).filter((c) => c.total > 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Material Costs</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {projectTitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setSelected(null);
            setModalOpen(true);
          }}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Project filter */}
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
      {!isLoading && (costs ?? []).length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryLabel}>Total material cost</Text>
            <Text style={styles.summaryTotal}>{formatCurrency(totalCost)}</Text>
          </View>
          <View style={styles.catBreakdown}>
            {byCat.map((cat) => (
              <View
                key={cat.key}
                style={[styles.catItem, { backgroundColor: cat.color }]}
              >
                <Text style={[styles.catItemLabel, { color: cat.text }]}>
                  {cat.label}
                </Text>
                <Text style={[styles.catItemValue, { color: cat.text }]}>
                  {formatCurrency(cat.total)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : !(costs ?? []).length ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>🧾</Text>
          <Text style={styles.emptyTitle}>No material costs yet</Text>
          <Text style={styles.emptyMsg}>
            Track paint, tools, and other expenses
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setModalOpen(true)}
          >
            <Text style={styles.emptyBtnText}>Add first item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={costs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CostCard
              item={item}
              onPress={() => {
                setSelected(item);
                setModalOpen(true);
              }}
              onDelete={handleDelete}
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

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setSelected(null);
          setModalOpen(true);
        }}
        activeOpacity={ActiveOpacity}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <CostModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        cost={selected}
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
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  summaryTotal: { fontSize: 22, fontWeight: "800", color: Colors.primary },
  catBreakdown: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catItem: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  catItemLabel: { fontSize: 10, fontWeight: "600", marginBottom: 1 },
  catItemValue: { fontSize: 12, fontWeight: "800" },
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
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 3,
  },
  cardSub: { fontSize: 12, color: Colors.textSecondary, marginBottom: 1 },
  cardDate: { fontSize: 11, color: Colors.textMuted },
  cardAmount: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 4,
  },
  cardQty: { fontSize: 12, color: Colors.textSecondary },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catBadgeText: { fontSize: 11, fontWeight: "600" },
  deleteBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
  },
  deleteBtnText: { fontSize: 11, color: Colors.danger, fontWeight: "600" },
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
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  catChipText: { fontSize: 12, color: Colors.textSecondary, fontWeight: "500" },
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
  totalPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  totalPreviewLabel: { fontSize: 14, color: Colors.primary, fontWeight: "600" },
  totalPreviewValue: { fontSize: 22, fontWeight: "800", color: Colors.primary },
});
