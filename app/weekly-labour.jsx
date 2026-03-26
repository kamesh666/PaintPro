import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, FlatList, RefreshControl,
  StatusBar, ActivityIndicator, SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useWorkers, useProjects } from '../hooks/useSupabase';
import { useAuthStore } from '../store/authStore';
import { Colors, Spacing, FontSize } from '../constants/colors';
import { formatCurrency, formatDate } from '../lib/utils';
import { showPaymentOptions } from '../lib/upiPayment';

const INPUT = {
  backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
  borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
  fontSize: 15, color: '#1A1A2E',
};

const DAYS     = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LBLS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SHIFTS   = [0, 0.5, 1, 1.5];
const SHIFT_LBL= ['–', '½', '1', '1½'];
const SHIFT_BG = ['#F3F4F6','#FEF3C7','#DBEAFE','#D1FAE5'];
const SHIFT_CLR= ['#9CA3AF','#92400E','#1E40AF','#065F46'];

// ─── Helpers ──────────────────────────────────────────────
function getMonday(d = new Date()) {
  const date = new Date(d);
  const day  = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0,0,0,0);
  return date;
}

function mondayStr(d) {
  return d.toISOString().split('T')[0];
}

function weekLabel(d) {
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  return `${fmt(d)} – ${fmt(end)}`;
}

function getWeekDates(weekStart) {
  return DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  });
}

// ─── Attendance Cell ──────────────────────────────────────
function AttCell({ value, onChange, size = 38 }) {
  const i = SHIFTS.indexOf(value);
  const idx = i === -1 ? 0 : i;
  return (
    <TouchableOpacity
      style={[styles.attCell, { width: size, height: size, backgroundColor: SHIFT_BG[idx] }]}
      onPress={() => onChange(SHIFTS[(idx + 1) % SHIFTS.length])}
      activeOpacity={0.7}
    >
      <Text style={[styles.attCellText, { color: SHIFT_CLR[idx] }]}>{SHIFT_LBL[idx]}</Text>
    </TouchableOpacity>
  );
}

// ─── Project Summary Card ─────────────────────────────────
function ProjectCard({ project, weekData, onPress }) {
  const totalLabour   = weekData.labour.reduce((s,l) => s + Number(l.gross_amount||0), 0);
  const totalMaterial = weekData.materials.reduce((s,m) => s + Number(m.total_cost||0), 0);
  const totalExpense  = weekData.expenses.reduce((s,e) => s + Number(e.amount||0), 0);
  const totalWorkers  = new Set(weekData.labour.map(l => l.worker_id)).size;
  const totalDays     = weekData.labour.reduce((s,l) => s + Number(l.total_days||0), 0);
  const grandTotal    = totalLabour + totalMaterial + totalExpense;

  return (
    <TouchableOpacity style={styles.projCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.projCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.projCardTitle} numberOfLines={1}>{project.title}</Text>
          {project.location ? <Text style={styles.projCardSub}>📍 {project.location}</Text> : null}
        </View>
        <View style={styles.projCardArrow}>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>Details ›</Text>
        </View>
      </View>

      {/* Week stats */}
      <View style={styles.projStatsRow}>
        <View style={styles.projStat}>
          <Text style={styles.projStatVal}>{totalWorkers}</Text>
          <Text style={styles.projStatLbl}>Workers</Text>
        </View>
        <View style={styles.projStat}>
          <Text style={styles.projStatVal}>{totalDays}</Text>
          <Text style={styles.projStatLbl}>Total shifts</Text>
        </View>
        <View style={styles.projStat}>
          <Text style={[styles.projStatVal, { color: Colors.primary }]}>{formatCurrency(totalLabour)}</Text>
          <Text style={styles.projStatLbl}>Labour</Text>
        </View>
        <View style={styles.projStat}>
          <Text style={[styles.projStatVal, { color: Colors.warning }]}>{formatCurrency(totalMaterial)}</Text>
          <Text style={styles.projStatLbl}>Materials</Text>
        </View>
        <View style={styles.projStat}>
          <Text style={[styles.projStatVal, { color: Colors.danger }]}>{formatCurrency(grandTotal)}</Text>
          <Text style={styles.projStatLbl}>Total cost</Text>
        </View>
      </View>

      {/* Worker mini list */}
      {weekData.labour.length > 0 && (
        <View style={styles.workerMiniRow}>
          {weekData.labour.slice(0,4).map((l,i) => (
            <View key={i} style={styles.workerMiniChip}>
              <Text style={styles.workerMiniAvatar}>{l.worker_name?.[0] ?? '?'}</Text>
              <Text style={styles.workerMiniName} numberOfLines={1}>{l.worker_name}</Text>
              <Text style={styles.workerMiniDays}>{l.total_days}d</Text>
            </View>
          ))}
          {weekData.labour.length > 4 && (
            <Text style={styles.workerMiniMore}>+{weekData.labour.length - 4} more</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Add Labour Sheet Modal ───────────────────────────────
function AddLabourModal({ visible, onClose, projectId, weekStart, onSaved }) {
  const { data: workers } = useWorkers();
  const profile = useAuthStore(s => s.profile);

  const [workerId,    setWorkerId]    = useState('');
  const [dailyRate,   setDailyRate]   = useState('');
  const [attendance,  setAttendance]  = useState(
    DAYS.reduce((a,d) => ({ ...a, [d]: 0 }), {})
  );
  const [advance,     setAdvance]     = useState('0');
  const [workerOpen,  setWorkerOpen]  = useState(false);
  const [saving,      setSaving]      = useState(false);

  const weekDates = getWeekDates(new Date(weekStart));

  useEffect(() => {
    if (visible) {
      setWorkerId(''); setDailyRate(''); setAdvance('0');
      setAttendance(DAYS.reduce((a,d) => ({ ...a, [d]: 0 }), {}));
      setWorkerOpen(false);
    }
  }, [visible]);

  const totalDays  = DAYS.reduce((s,d) => s + (attendance[d]||0), 0);
  const grossAmt   = totalDays * (parseFloat(dailyRate)||0);
  const balanceDue = grossAmt - (parseFloat(advance)||0);
  const selWorker  = workers?.find(w => w.id === workerId);

  const handleSave = async () => {
    if (!workerId)  { Alert.alert('Required','Select a worker'); return; }
    if (!dailyRate) { Alert.alert('Required','Enter daily rate'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('weekly_sheets').insert({
        project_id:   projectId,
        worker_id:    workerId,
        week_start:   weekStart,
        daily_rate:   parseFloat(dailyRate)||0,
        ...attendance,
        advance_paid: parseFloat(advance)||0,
        created_by:   profile?.id,
      });
      if (error) throw error;
      onSaved(); onClose();
    } catch(e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={{ padding:4, width:32 }}>
            <Text style={{ fontSize:18, color: Colors.textSecondary }}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add labour — Week of {weekStart}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}
            style={[styles.saveBtn, saving && { opacity:0.5 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex:1, padding:16 }} keyboardShouldPersistTaps="handled">

          {/* Worker picker */}
          <Text style={styles.label}>Worker *</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setWorkerOpen(!workerOpen)}>
            <Text style={selWorker ? styles.pickerVal : styles.pickerPh}>
              {selWorker ? `${selWorker.name} · ₹${selWorker.daily_rate}/shift` : 'Select worker'}
            </Text>
            <Text style={styles.pickerArrow}>{workerOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {workerOpen && (
            <View style={styles.dropdown}>
              {(workers??[]).map(w => (
                <TouchableOpacity key={w.id}
                  style={[styles.dropItem, workerId===w.id && styles.dropItemActive]}
                  onPress={() => {
                    setWorkerId(w.id);
                    setDailyRate(w.daily_rate?.toString()??'');
                    setWorkerOpen(false);
                  }}>
                  <Text style={[styles.dropText, workerId===w.id && { color:Colors.primary, fontWeight:'700' }]}>{w.name}</Text>
                  <Text style={styles.dropSub}>{w.skill_type} · ₹{w.daily_rate}/shift</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Daily rate (₹) *</Text>
          <TextInput style={INPUT} value={dailyRate} onChangeText={setDailyRate}
            placeholder="e.g. 700" placeholderTextColor="#9CA3AF"
            keyboardType="numeric" underlineColorAndroid="transparent" />

          {/* Attendance grid */}
          <Text style={styles.label}>Attendance — tap to cycle: Absent → ½ → 1 shift → 1½ shifts</Text>
          <View style={styles.attGrid}>
            {DAYS.map((d,i) => (
              <View key={d} style={styles.attCol}>
                <Text style={styles.attDayLbl}>{DAY_LBLS[i]}</Text>
                <Text style={styles.attDateLbl}>{weekDates[i]}</Text>
                <AttCell value={attendance[d]}
                  onChange={val => setAttendance(p => ({ ...p, [d]: val }))} />
              </View>
            ))}
          </View>

          {/* Summary */}
          <View style={styles.summBox}>
            <View style={styles.summItem}>
              <Text style={styles.summLbl}>Total shifts</Text>
              <Text style={styles.summVal}>{totalDays}</Text>
            </View>
            <View style={styles.summDiv} />
            <View style={styles.summItem}>
              <Text style={styles.summLbl}>Gross amount</Text>
              <Text style={[styles.summVal, { color:Colors.primary }]}>{formatCurrency(grossAmt)}</Text>
            </View>
          </View>

          <Text style={styles.label}>Advance paid (₹)</Text>
          <TextInput style={INPUT} value={advance} onChangeText={setAdvance}
            placeholder="0" placeholderTextColor="#9CA3AF"
            keyboardType="numeric" underlineColorAndroid="transparent" />

          <View style={[styles.balBox, { borderColor: balanceDue>0 ? Colors.danger+'55' : Colors.success+'55' }]}>
            <Text style={styles.balLbl}>Balance due to worker</Text>
            <Text style={[styles.balVal, { color: balanceDue>0 ? Colors.danger : Colors.success }]}>
              {formatCurrency(Math.abs(balanceDue))}
            </Text>
          </View>

          <View style={{ height:60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Add Expense Modal ────────────────────────────────────
function AddExpenseModal({ visible, onClose, projectId, weekStart, onSaved }) {
  const profile  = useAuthStore(s => s.profile);
  const [desc,   setDesc]   = useState('');
  const [amount, setAmount] = useState('');
  const [cat,    setCat]    = useState('other');
  const [saving, setSaving] = useState(false);

  const CATS = [
    { k:'fuel',      l:'⛽ Fuel'      },
    { k:'transport', l:'🚛 Transport' },
    { k:'food',      l:'🍱 Food'      },
    { k:'tools',     l:'🔧 Tools'     },
    { k:'other',     l:'📦 Other'     },
  ];

  useEffect(() => {
    if (visible) { setDesc(''); setAmount(''); setCat('other'); }
  }, [visible]);

  const handleSave = async () => {
    if (!desc.trim()) { Alert.alert('Required','Enter description'); return; }
    if (!amount)      { Alert.alert('Required','Enter amount'); return; }
    setSaving(true);
    try {
      // Store in material_costs table with category
      const { error } = await supabase.from('material_costs').insert({
        project_id:    projectId,
        item_name:     desc.trim(),
        total_cost:    parseFloat(amount)||0,
        category:      cat,
        purchase_date: weekStart,
        added_by:      profile?.id,
      });
      if (error) throw error;
      onSaved(); onClose();
    } catch(e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={{ padding:4, width:32 }}>
            <Text style={{ fontSize:18, color:Colors.textSecondary }}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add expense</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}
            style={[styles.saveBtn, saving && { opacity:0.5 }]}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex:1, padding:16 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Category</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:4 }}>
            {CATS.map(c => (
              <TouchableOpacity key={c.k}
                style={[styles.catChip, cat===c.k && styles.catChipActive]}
                onPress={() => setCat(c.k)}>
                <Text style={[styles.catChipText, cat===c.k && { color:Colors.primary, fontWeight:'700' }]}>{c.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Description *</Text>
          <TextInput style={INPUT} value={desc} onChangeText={setDesc}
            placeholder="e.g. Diesel for generator" placeholderTextColor="#9CA3AF"
            underlineColorAndroid="transparent" />
          <Text style={styles.label}>Amount (₹) *</Text>
          <TextInput style={[INPUT,{ fontSize:22, fontWeight:'700', color:Colors.primary }]}
            value={amount} onChangeText={setAmount}
            placeholder="0" placeholderTextColor="#9CA3AF"
            keyboardType="numeric" underlineColorAndroid="transparent" />
          <View style={{ height:60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Project Detail Modal ─────────────────────────────────
function ProjectDetailModal({ visible, onClose, project, weekStart, weekData, onRefresh }) {
  if (!project) return null;
  const totalLabour   = weekData.labour.reduce((s,l)   => s + Number(l.gross_amount||0), 0);
  const totalAdvance  = weekData.labour.reduce((s,l)   => s + Number(l.advance_paid||0), 0);
  const totalBalance  = weekData.labour.reduce((s,l)   => s + Number(l.balance_due||0),  0);
  const totalMaterial = weekData.materials.reduce((s,m)=> s + Number(m.total_cost||0),   0);
  const totalExpense  = weekData.expenses.reduce((s,e) => s + Number(e.amount||0),        0);
  const grandTotal    = totalLabour + totalMaterial + totalExpense;

  const [addLabour,  setAddLabour]  = useState(false);
  const [addExpense, setAddExpense] = useState(false);

  const weekDates = getWeekDates(new Date(weekStart));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={[styles.modalHeader, { backgroundColor: Colors.primary }]}>
          <TouchableOpacity onPress={onClose} style={{ padding:4 }}>
            <Text style={{ fontSize:18, color:'#fff' }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={[styles.modalTitle, { color:'#fff' }]} numberOfLines={1}>{project.title}</Text>
            <Text style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>Week: {weekLabel(new Date(weekStart))}</Text>
          </View>
          <View style={{ width:32 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Cost summary */}
          <View style={styles.detailSummary}>
            <View style={styles.detailSumItem}>
              <Text style={styles.detailSumVal}>{formatCurrency(totalLabour)}</Text>
              <Text style={styles.detailSumLbl}>Labour</Text>
            </View>
            <View style={styles.detailSumItem}>
              <Text style={[styles.detailSumVal,{ color:Colors.warning }]}>{formatCurrency(totalMaterial)}</Text>
              <Text style={styles.detailSumLbl}>Materials</Text>
            </View>
            <View style={styles.detailSumItem}>
              <Text style={[styles.detailSumVal,{ color:Colors.danger }]}>{formatCurrency(totalExpense)}</Text>
              <Text style={styles.detailSumLbl}>Expenses</Text>
            </View>
            <View style={styles.detailSumItem}>
              <Text style={[styles.detailSumVal,{ color:Colors.primary, fontSize:16 }]}>{formatCurrency(grandTotal)}</Text>
              <Text style={styles.detailSumLbl}>Grand total</Text>
            </View>
          </View>

          {/* Quick actions */}
          <View style={styles.detailActions}>
            <TouchableOpacity style={styles.detailActionBtn} onPress={() => setAddLabour(true)}>
              <Text style={styles.detailActionText}>👷 Add labour</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.detailActionBtn,{ backgroundColor:'#FEF3C7' }]} onPress={() => setAddExpense(true)}>
              <Text style={[styles.detailActionText,{ color:'#92400E' }]}>📦 Add expense</Text>
            </TouchableOpacity>
          </View>

          {/* ── Labour Section ── */}
          <Text style={styles.detailSectionTitle}>👷 Labour this week</Text>
          {weekData.labour.length === 0 ? (
            <Text style={styles.detailEmpty}>No labour logged yet</Text>
          ) : weekData.labour.map((l,i) => {
            const balance = Number(l.balance_due||0);
            return (
              <View key={i} style={styles.labourCard}>
                <View style={styles.labourCardTop}>
                  <View style={styles.workerAvatarSm}>
                    <Text style={styles.workerAvatarSmText}>{l.worker_name?.[0]??'?'}</Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={styles.labourWorkerName}>{l.worker_name}</Text>
                    <Text style={styles.labourWorkerSkill}>{l.worker_skill} · ₹{l.daily_rate}/shift</Text>
                  </View>
                  <View style={{ alignItems:'flex-end' }}>
                    <Text style={styles.labourGross}>{formatCurrency(l.gross_amount)}</Text>
                    <Text style={styles.labourDays}>{l.total_days} shifts</Text>
                  </View>
                </View>

                {/* Attendance mini view */}
                <View style={styles.attMiniRow}>
                  {DAYS.map((d,i) => {
                    const val = l[d]??0;
                    const si  = SHIFTS.indexOf(val);
                    const idx = si===-1?0:si;
                    return (
                      <View key={d} style={[styles.attMiniCell,{ backgroundColor:SHIFT_BG[idx] }]}>
                        <Text style={[styles.attMiniDayLbl,{ color:Colors.textMuted }]}>{DAY_LBLS[i][0]}</Text>
                        <Text style={[styles.attMiniVal,{ color:SHIFT_CLR[idx] }]}>
                          {val===0?'–':SHIFT_LBL[idx]}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Payment row */}
                <View style={styles.labourPayRow}>
                  <View style={styles.labourPayItem}>
                    <Text style={styles.labourPayLbl}>Advance</Text>
                    <Text style={[styles.labourPayVal,{ color:Colors.warning }]}>{formatCurrency(l.advance_paid)}</Text>
                  </View>
                  <View style={styles.labourPayItem}>
                    <Text style={styles.labourPayLbl}>Balance due</Text>
                    <Text style={[styles.labourPayVal,{ color:balance>0?Colors.danger:Colors.success }]}>
                      {formatCurrency(Math.abs(balance))}
                    </Text>
                  </View>
                  {balance > 0 && (
                    <TouchableOpacity style={styles.upiPayBtn}
                      onPress={() => showPaymentOptions({
                        phoneNumber: l.worker_phone,
                        name:        l.worker_name,
                        amount:      balance,
                        note:        `Salary - ${l.worker_name} - ${weekStart}`,
                      })}>
                      <Text style={styles.upiPayBtnText}>💸 Pay via UPI</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* ── Materials Section ── */}
          <Text style={styles.detailSectionTitle}>🧾 Materials used</Text>
          {weekData.materials.length === 0 ? (
            <Text style={styles.detailEmpty}>No materials recorded</Text>
          ) : weekData.materials.map((m,i) => (
            <View key={i} style={styles.expenseCard}>
              <View style={{ flex:1 }}>
                <Text style={styles.expenseName}>{m.item_name}</Text>
                {m.vendor_name ? <Text style={styles.expenseSub}>🏪 {m.vendor_name}</Text> : null}
                <Text style={styles.expenseSub}>📅 {formatDate(m.purchase_date)}</Text>
              </View>
              <Text style={styles.expenseAmt}>{formatCurrency(m.total_cost)}</Text>
            </View>
          ))}

          {/* ── Other Expenses Section ── */}
          {weekData.expenses.length > 0 && (
            <>
              <Text style={styles.detailSectionTitle}>📦 Other expenses</Text>
              {weekData.expenses.map((e,i) => (
                <View key={i} style={styles.expenseCard}>
                  <View style={{ flex:1 }}>
                    <Text style={styles.expenseName}>{e.item_name}</Text>
                    <Text style={styles.expenseSub}>📅 {formatDate(e.purchase_date)}</Text>
                  </View>
                  <Text style={[styles.expenseAmt,{ color:Colors.danger }]}>{formatCurrency(e.total_cost)}</Text>
                </View>
              ))}
            </>
          )}

          {/* ── History: All weeks for this project ── */}
          <Text style={styles.detailSectionTitle}>📜 Labour history (all weeks)</Text>
          <HistorySection projectId={project.id} />

          <View style={{ height:60 }} />
        </ScrollView>
      </View>

      <AddLabourModal
        visible={addLabour} onClose={() => setAddLabour(false)}
        projectId={project.id} weekStart={weekStart}
        onSaved={() => { onRefresh(); setAddLabour(false); }} />
      <AddExpenseModal
        visible={addExpense} onClose={() => setAddExpense(false)}
        projectId={project.id} weekStart={weekStart}
        onSaved={() => { onRefresh(); setAddExpense(false); }} />
    </Modal>
  );
}

// ─── History Section ──────────────────────────────────────
function HistorySection({ projectId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('weekly_sheet_summary').select('*')
      .eq('project_id', projectId)
      .order('week_start', { ascending: false })
      .then(({ data }) => { setHistory(data??[]); setLoading(false); });
  }, [projectId]);

  if (loading) return <ActivityIndicator color={Colors.primary} style={{ margin:16 }} />;
  if (!history.length) return <Text style={styles.detailEmpty}>No history yet</Text>;

  // Group by week
  const weeks = {};
  history.forEach(h => {
    if (!weeks[h.week_start]) weeks[h.week_start] = [];
    weeks[h.week_start].push(h);
  });

  return (
    <View>
      {Object.entries(weeks).map(([week, sheets]) => {
        const weekTotal = sheets.reduce((s,sh) => s + Number(sh.gross_amount||0), 0);
        const weekDays  = sheets.reduce((s,sh) => s + Number(sh.total_days||0),   0);
        return (
          <View key={week} style={styles.historyWeek}>
            <View style={styles.historyWeekHeader}>
              <Text style={styles.historyWeekDate}>📅 {weekLabel(new Date(week))}</Text>
              <Text style={styles.historyWeekTotal}>{formatCurrency(weekTotal)}</Text>
            </View>
            {sheets.map((sh,i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyWorker}>{sh.worker_name}</Text>
                <Text style={styles.historyDays}>{sh.total_days} shifts</Text>
                <Text style={styles.historyAmt}>{formatCurrency(sh.gross_amount)}</Text>
                <Text style={[styles.historyBal,{ color: Number(sh.balance_due||0)>0 ? Colors.danger : Colors.success }]}>
                  Bal: {formatCurrency(Math.abs(sh.balance_due||0))}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function WeeklyLabourScreen() {
  const router = useRouter();
  const { data: projects } = useProjects();

  const [weekStart,     setWeekStart]     = useState(mondayStr(getMonday()));
  const [weekData,      setWeekData]      = useState({});   // { projectId: { labour, materials, expenses } }
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [selProject,    setSelProject]    = useState(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [addLabourOpen, setAddLabourOpen] = useState(false);
  const [addExpOpen,    setAddExpOpen]    = useState(false);
  const [selProjForAdd, setSelProjForAdd] = useState(null);

  const fetchWeekData = useCallback(async () => {
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = mondayStr(weekEnd);

      const [labourRes, matRes] = await Promise.all([
        supabase.from('weekly_sheet_summary').select('*')
          .eq('week_start', weekStart),
        supabase.from('material_costs').select('*')
          .gte('purchase_date', weekStart)
          .lte('purchase_date', weekEndStr),
      ]);

      const labour    = labourRes.data ?? [];
      const materials = matRes.data    ?? [];

      // Group by project
      const grouped = {};
      const EXPENSE_CATS = ['fuel','transport','food','tools','other'];

      labour.forEach(l => {
        if (!grouped[l.project_id]) grouped[l.project_id] = { labour:[], materials:[], expenses:[] };
        grouped[l.project_id].labour.push(l);
      });

      materials.forEach(m => {
        const pid = m.project_id;
        if (!pid) return;
        if (!grouped[pid]) grouped[pid] = { labour:[], materials:[], expenses:[] };
        if (EXPENSE_CATS.includes(m.category)) {
          grouped[pid].expenses.push(m);
        } else {
          grouped[pid].materials.push(m);
        }
      });

      setWeekData(grouped);
    } catch(e) {
      console.log('Weekly fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchWeekData(); }, [fetchWeekData]);

  // Navigate weeks
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(mondayStr(d));
    setLoading(true);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(mondayStr(d));
    setLoading(true);
  };
  const goToday = () => {
    setWeekStart(mondayStr(getMonday()));
    setLoading(true);
  };

  const isCurrentWeek = weekStart === mondayStr(getMonday());

  // Summary totals for the week
  const weekTotals = Object.values(weekData).reduce((s, pd) => ({
    labour:    s.labour    + pd.labour.reduce((a,l)    => a + Number(l.gross_amount||0), 0),
    materials: s.materials + pd.materials.reduce((a,m) => a + Number(m.total_cost||0),  0),
    expenses:  s.expenses  + pd.expenses.reduce((a,e)  => a + Number(e.total_cost||0),  0),
  }), { labour:0, materials:0, expenses:0 });

  // Projects that have data this week OR all active projects
  const activeProjects = (projects??[]).filter(p => p.status === 'active');
  const projectsWithData = activeProjects.filter(p => weekData[p.id]);
  const projectsWithout  = activeProjects.filter(p => !weekData[p.id]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding:4 }}>
          <Text style={{ color:'#fff', fontSize:15, fontWeight:'600' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Weekly Labour</Text>
        <View style={{ width:60 }} />
      </View>

      {/* Week navigator */}
      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.weekNavBtn} onPress={prevWeek}>
          <Text style={styles.weekNavBtnText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekNavCenter} onPress={goToday}>
          <Text style={styles.weekNavDate}>{weekLabel(new Date(weekStart))}</Text>
          {isCurrentWeek
            ? <View style={styles.currentWeekBadge}><Text style={styles.currentWeekText}>Current week</Text></View>
            : <Text style={styles.tapToday}>Tap to go to current week</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekNavBtn} onPress={nextWeek}>
          <Text style={styles.weekNavBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Week cost summary */}
      {!loading && Object.keys(weekData).length > 0 && (
        <View style={styles.weekSummary}>
          <View style={styles.weekSummItem}>
            <Text style={styles.weekSummVal}>{formatCurrency(weekTotals.labour)}</Text>
            <Text style={styles.weekSummLbl}>Labour</Text>
          </View>
          <View style={styles.weekSummDiv} />
          <View style={styles.weekSummItem}>
            <Text style={[styles.weekSummVal,{ color:Colors.warning }]}>{formatCurrency(weekTotals.materials)}</Text>
            <Text style={styles.weekSummLbl}>Materials</Text>
          </View>
          <View style={styles.weekSummDiv} />
          <View style={styles.weekSummItem}>
            <Text style={[styles.weekSummVal,{ color:Colors.danger }]}>{formatCurrency(weekTotals.expenses)}</Text>
            <Text style={styles.weekSummLbl}>Expenses</Text>
          </View>
          <View style={styles.weekSummDiv} />
          <View style={styles.weekSummItem}>
            <Text style={[styles.weekSummVal,{ color:Colors.primary, fontSize:15 }]}>
              {formatCurrency(weekTotals.labour + weekTotals.materials + weekTotals.expenses)}
            </Text>
            <Text style={styles.weekSummLbl}>Total</Text>
          </View>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding:16, paddingBottom:80 }}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchWeekData(); }}
          tintColor={Colors.primary} />}
      >
        {loading ? (
          <View style={{ alignItems:'center', paddingVertical:40 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ marginTop:12, color:Colors.textSecondary }}>Loading week data...</Text>
          </View>
        ) : (
          <>
            {/* Projects WITH data */}
            {projectsWithData.length > 0 && (
              <>
                <Text style={styles.sectionLbl}>🎨 Active this week</Text>
                {projectsWithData.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    weekData={weekData[p.id]}
                    onPress={() => { setSelProject(p); setDetailOpen(true); }}
                  />
                ))}
              </>
            )}

            {/* Projects WITHOUT data — tap to add */}
            {projectsWithout.length > 0 && (
              <>
                <Text style={styles.sectionLbl}>➕ Add labour to project</Text>
                {projectsWithout.map(p => (
                  <TouchableOpacity key={p.id} style={styles.emptyProjCard}
                    onPress={() => { setSelProjForAdd(p); setAddLabourOpen(true); }}
                    activeOpacity={0.8}>
                    <View style={{ flex:1 }}>
                      <Text style={styles.emptyProjTitle}>{p.title}</Text>
                      {p.location ? <Text style={styles.emptyProjSub}>📍 {p.location}</Text> : null}
                    </View>
                    <Text style={styles.emptyProjAdd}>+ Add labour</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {activeProjects.length === 0 && (
              <View style={styles.noProjects}>
                <Text style={{ fontSize:48, marginBottom:16 }}>🏗️</Text>
                <Text style={styles.noProjectsTitle}>No active projects</Text>
                <Text style={styles.noProjectsSub}>Create a project first, then log labour here</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Project Detail Modal */}
      <ProjectDetailModal
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        project={selProject}
        weekStart={weekStart}
        weekData={selProject ? (weekData[selProject.id] ?? { labour:[], materials:[], expenses:[] }) : { labour:[], materials:[], expenses:[] }}
        onRefresh={fetchWeekData}
      />

      {/* Add Labour to empty project */}
      <AddLabourModal
        visible={addLabourOpen}
        onClose={() => setAddLabourOpen(false)}
        projectId={selProjForAdd?.id}
        weekStart={weekStart}
        onSaved={() => { fetchWeekData(); setAddLabourOpen(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, backgroundColor:Colors.background },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:Colors.primary, paddingHorizontal:16, paddingVertical:14, paddingTop:48 },
  headerTitle:  { color:'#fff', fontSize:18, fontWeight:'700' },

  weekNav:       { flexDirection:'row', alignItems:'center', backgroundColor:'#FFFFFF', borderBottomWidth:0.5, borderBottomColor:'#E0E0E0' },
  weekNavBtn:    { padding:16 },
  weekNavBtnText:{ fontSize:24, color:Colors.primary, fontWeight:'700' },
  weekNavCenter: { flex:1, alignItems:'center', paddingVertical:12 },
  weekNavDate:   { fontSize:15, fontWeight:'700', color:'#1A1A2E', marginBottom:3 },
  currentWeekBadge: { backgroundColor:Colors.primary+'18', paddingHorizontal:10, paddingVertical:2, borderRadius:10 },
  currentWeekText:  { fontSize:11, color:Colors.primary, fontWeight:'600' },
  tapToday:      { fontSize:11, color:Colors.textMuted },

  weekSummary:   { flexDirection:'row', backgroundColor:'#FFFFFF', paddingVertical:12, borderBottomWidth:0.5, borderBottomColor:'#E0E0E0' },
  weekSummItem:  { flex:1, alignItems:'center' },
  weekSummVal:   { fontSize:14, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
  weekSummLbl:   { fontSize:10, color:Colors.textMuted },
  weekSummDiv:   { width:0.5, backgroundColor:'#E0E0E0' },

  sectionLbl:    { fontSize:13, fontWeight:'700', color:Colors.textMuted, textTransform:'uppercase', letterSpacing:0.5, marginBottom:10, marginTop:4 },

  projCard:      { backgroundColor:'#FFFFFF', borderRadius:16, marginBottom:12, padding:14, elevation:2, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:8 },
  projCardHeader:{ flexDirection:'row', alignItems:'flex-start', marginBottom:10 },
  projCardTitle: { fontSize:16, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
  projCardSub:   { fontSize:12, color:Colors.textSecondary },
  projCardArrow: { paddingLeft:8 },
  projStatsRow:  { flexDirection:'row', backgroundColor:'#F8FAFC', borderRadius:10, padding:10, marginBottom:10 },
  projStat:      { flex:1, alignItems:'center' },
  projStatVal:   { fontSize:13, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
  projStatLbl:   { fontSize:9, color:Colors.textMuted },
  workerMiniRow: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  workerMiniChip:{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'#EFF6FF', borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  workerMiniAvatar: { width:20, height:20, borderRadius:10, backgroundColor:Colors.primary, alignItems:'center', justifyContent:'center' },
  workerMiniName:{ fontSize:11, color:Colors.primary, fontWeight:'600', maxWidth:60 },
  workerMiniDays:{ fontSize:10, color:Colors.textMuted },
  workerMiniMore:{ fontSize:12, color:Colors.textMuted, alignSelf:'center' },

  emptyProjCard: { flexDirection:'row', alignItems:'center', backgroundColor:'#FFFFFF', borderRadius:12, marginBottom:8, padding:14, borderWidth:1.5, borderColor:'#E0E0E0', borderStyle:'dashed' },
  emptyProjTitle:{ fontSize:14, fontWeight:'700', color:'#1A1A2E', marginBottom:2 },
  emptyProjSub:  { fontSize:12, color:Colors.textSecondary },
  emptyProjAdd:  { fontSize:13, fontWeight:'700', color:Colors.primary },

  noProjects:    { alignItems:'center', paddingVertical:40 },
  noProjectsTitle:{ fontSize:17, fontWeight:'700', color:'#1A1A2E', marginBottom:8 },
  noProjectsSub: { fontSize:14, color:Colors.textSecondary, textAlign:'center' },

  // Detail modal
  detailSummary: { flexDirection:'row', backgroundColor:'#FFFFFF', paddingVertical:14, borderBottomWidth:0.5, borderBottomColor:'#E0E0E0' },
  detailSumItem: { flex:1, alignItems:'center' },
  detailSumVal:  { fontSize:15, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
  detailSumLbl:  { fontSize:10, color:Colors.textMuted },
  detailActions: { flexDirection:'row', gap:10, padding:16, paddingBottom:0 },
  detailActionBtn:{ flex:1, backgroundColor:'#EFF6FF', borderRadius:10, padding:12, alignItems:'center' },
  detailActionText:{ fontSize:14, fontWeight:'700', color:Colors.primary },
  detailSectionTitle: { fontSize:14, fontWeight:'700', color:'#1A1A2E', paddingHorizontal:16, paddingTop:20, paddingBottom:8 },
  detailEmpty:   { fontSize:13, color:Colors.textMuted, paddingHorizontal:16, paddingBottom:8 },

  labourCard:    { backgroundColor:'#FFFFFF', marginHorizontal:16, marginBottom:10, borderRadius:14, padding:14, elevation:1, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:6 },
  labourCardTop: { flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 },
  workerAvatarSm:{ width:40, height:40, borderRadius:20, backgroundColor:Colors.primary+'18', alignItems:'center', justifyContent:'center' },
  workerAvatarSmText:{ fontSize:16, fontWeight:'700', color:Colors.primary },
  labourWorkerName:{ fontSize:15, fontWeight:'700', color:'#1A1A2E', marginBottom:2 },
  labourWorkerSkill:{ fontSize:12, color:Colors.textSecondary },
  labourGross:   { fontSize:16, fontWeight:'800', color:Colors.primary, marginBottom:2 },
  labourDays:    { fontSize:12, color:Colors.textSecondary },

  attMiniRow:    { flexDirection:'row', gap:4, marginBottom:10 },
  attMiniCell:   { flex:1, borderRadius:6, paddingVertical:5, alignItems:'center' },
  attMiniDayLbl: { fontSize:9, fontWeight:'600', marginBottom:2 },
  attMiniVal:    { fontSize:12, fontWeight:'700' },

  labourPayRow:  { flexDirection:'row', alignItems:'center', gap:10, paddingTop:8, borderTopWidth:0.5, borderTopColor:'#F0F0F0' },
  labourPayItem: { flex:1 },
  labourPayLbl:  { fontSize:10, color:Colors.textMuted, marginBottom:2 },
  labourPayVal:  { fontSize:14, fontWeight:'800' },
  upiPayBtn:     { backgroundColor:'#D1FAE5', paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  upiPayBtnText: { fontSize:12, fontWeight:'700', color:'#065F46' },

  expenseCard:   { flexDirection:'row', alignItems:'center', backgroundColor:'#FFFFFF', marginHorizontal:16, marginBottom:8, borderRadius:12, padding:12, elevation:1 },
  expenseName:   { fontSize:14, fontWeight:'600', color:'#1A1A2E', marginBottom:2 },
  expenseSub:    { fontSize:11, color:Colors.textMuted },
  expenseAmt:    { fontSize:16, fontWeight:'800', color:Colors.primary },

  historyWeek:   { marginHorizontal:16, marginBottom:12, backgroundColor:'#FFFFFF', borderRadius:12, overflow:'hidden', elevation:1 },
  historyWeekHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#F8FAFC', padding:10 },
  historyWeekDate:{ fontSize:12, fontWeight:'700', color:'#1A1A2E' },
  historyWeekTotal:{ fontSize:14, fontWeight:'800', color:Colors.primary },
  historyRow:    { flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:8, borderTopWidth:0.5, borderTopColor:'#F0F0F0', gap:6 },
  historyWorker: { flex:1, fontSize:13, fontWeight:'600', color:'#1A1A2E' },
  historyDays:   { fontSize:12, color:Colors.textSecondary, width:52 },
  historyAmt:    { fontSize:13, fontWeight:'700', color:Colors.primary, width:64, textAlign:'right' },
  historyBal:    { fontSize:11, fontWeight:'600', width:72, textAlign:'right' },

  attGrid:       { flexDirection:'row', gap:4, marginBottom:4 },
  attCol:        { flex:1, alignItems:'center', gap:4 },
  attDayLbl:     { fontSize:11, fontWeight:'700', color:'#1A1A2E' },
  attDateLbl:    { fontSize:9, color:Colors.textMuted, textAlign:'center' },
  attCell:       { borderRadius:8, alignItems:'center', justifyContent:'center' },
  attCellText:   { fontSize:14, fontWeight:'800' },

  summBox:       { flexDirection:'row', backgroundColor:'#F0F9FF', borderRadius:12, padding:14, marginTop:10, borderWidth:1, borderColor:'#BAE6FD' },
  summItem:      { flex:1, alignItems:'center' },
  summLbl:       { fontSize:11, color:'#0369A1', marginBottom:2 },
  summVal:       { fontSize:16, fontWeight:'800', color:'#1A1A2E' },
  summDiv:       { width:0.5, backgroundColor:'#BAE6FD' },
  balBox:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#FFFFFF', borderRadius:12, padding:14, marginTop:10, borderWidth:1.5 },
  balLbl:        { fontSize:14, fontWeight:'600', color:'#1A1A2E' },
  balVal:        { fontSize:22, fontWeight:'900' },

  catChip:       { paddingHorizontal:12, paddingVertical:7, borderRadius:20, backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB' },
  catChipActive: { backgroundColor:'#EFF6FF', borderColor:Colors.primary+'55' },
  catChipText:   { fontSize:12, color:Colors.textSecondary },

  modal:         { flex:1, backgroundColor:Colors.background },
  modalHeader:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, backgroundColor:'#FFFFFF', borderBottomWidth:0.5, borderBottomColor:'#E0E0E0' },
  modalTitle:    { fontSize:16, fontWeight:'700', color:'#1A1A2E', flex:1, marginHorizontal:8 },
  saveBtn:       { backgroundColor:Colors.primary, paddingHorizontal:16, paddingVertical:7, borderRadius:8 },
  saveBtnText:   { color:'#fff', fontWeight:'700', fontSize:14 },
  label:         { fontSize:13, fontWeight:'600', color:Colors.textSecondary, marginBottom:6, marginTop:14 },
  picker:        { backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#D1D5DB', borderRadius:10, paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  pickerVal:     { fontSize:15, color:'#1A1A2E', flex:1 },
  pickerPh:      { fontSize:15, color:'#9CA3AF', flex:1 },
  pickerArrow:   { fontSize:12, color:Colors.textMuted },
  dropdown:      { backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#D1D5DB', borderRadius:10, marginTop:4, overflow:'hidden' },
  dropItem:      { paddingHorizontal:16, paddingVertical:12, borderBottomWidth:0.5, borderBottomColor:'#F0F0F0' },
  dropItemActive:{ backgroundColor:'#EFF6FF' },
  dropText:      { fontSize:15, color:'#1A1A2E' },
  dropSub:       { fontSize:11, color:Colors.textMuted, marginTop:2 },
});
