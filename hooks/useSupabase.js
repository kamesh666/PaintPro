import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ─── PROJECTS ─────────────────────────────────────────────
export const useProjects = (status) =>
  useQuery({
    queryKey: ['projects', status],
    queryFn: async () => {
      let q = supabase
        .from('projects')
        .select(`*, clients(name, phone)`)
        .order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const useProject = (id) =>
  useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`*, clients(*), project_photos(*), material_costs(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

export const useProjectSummary = (id) =>
  useQuery({
    queryKey: ['project_summary', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_summary')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

export const useProjectHistory = (projectId) =>
  useQuery({
    queryKey: ['project_history', projectId],
    queryFn: async () => {
      const [
        projectRes,
        materialRes,
        labourRes,
        paymentRes,
        photoRes,
        quotationRes,
        invoiceRes,
      ] = await Promise.all([
        supabase.from('projects').select('*, clients(name, phone)').eq('id', projectId).single(),
        supabase.from('material_costs').select('*').eq('project_id', projectId).order('purchase_date', { ascending: false }),
        supabase.from('labour_logs').select('*, workers(name)').eq('project_id', projectId).order('log_date', { ascending: false }),
        supabase.from('client_payments').select('*').eq('project_id', projectId).order('payment_date', { ascending: false }),
        supabase.from('project_photos').select('id, caption, uploaded_at').eq('project_id', projectId).order('uploaded_at', { ascending: false }),
        supabase.from('quotations').select('id, quote_no, quote_date, total_amount, status, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('invoices').select('id, invoice_no, invoice_date, total, status, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
      ]);

      if (projectRes.error) throw projectRes.error;
      if (materialRes.error) throw materialRes.error;
      if (labourRes.error) throw labourRes.error;
      if (paymentRes.error) throw paymentRes.error;
      if (photoRes.error) throw photoRes.error;
      if (quotationRes.error) throw quotationRes.error;
      if (invoiceRes.error) throw invoiceRes.error;

      return {
        project: projectRes.data,
        materialCosts: materialRes.data ?? [],
        labourLogs: labourRes.data ?? [],
        payments: paymentRes.data ?? [],
        photos: photoRes.data ?? [],
        quotations: quotationRes.data ?? [],
        invoices: invoiceRes.data ?? [],
      };
    },
    enabled: !!projectId,
  });

export const useUpsertProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project) => {
      const { data, error } = project.id
        ? await supabase.from('projects').update(project).eq('id', project.id).select().single()
        : await supabase.from('projects').insert(project).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
};


// ─── CLIENTS ──────────────────────────────────────────────
export const useClients = () =>
  useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

export const useUpsertClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client) => {
      const { data, error } = client.id
        ? await supabase.from('clients').update(client).eq('id', client.id).select().single()
        : await supabase.from('clients').insert(client).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
};


// ─── WORKERS ──────────────────────────────────────────────
export const useWorkers = () =>
  useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

export const useUpsertWorker = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (worker) => {
      const { data, error } = worker.id
        ? await supabase.from('workers').update(worker).eq('id', worker.id).select().single()
        : await supabase.from('workers').insert(worker).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
  });
};


// ─── LABOUR LOGS ──────────────────────────────────────────
export const useLabourLogs = (projectId) =>
  useQuery({
    queryKey: ['labour_logs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labour_logs')
        .select(`*, workers(name, skill_type)`)
        .eq('project_id', projectId)
        .order('log_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

export const useAddLabourLog = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log) => {
      const { data, error } = await supabase
        .from('labour_logs')
        .insert(log)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['labour_logs', variables.project_id] });
      qc.invalidateQueries({ queryKey: ['project_summary'] });
    },
  });
};

export const useMarkLabourPaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }) => {
      const { error } = await supabase
        .from('labour_logs')
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { id, projectId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['labour_logs', data.projectId] });
    },
  });
};


// ─── MATERIAL COSTS ───────────────────────────────────────
export const useMaterialCosts = (projectId) =>
  useQuery({
    queryKey: ['material_costs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_costs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

export const useAddMaterialCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cost) => {
      const { data, error } = await supabase
        .from('material_costs')
        .insert(cost)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['material_costs', variables.project_id] });
      qc.invalidateQueries({ queryKey: ['project_summary'] });
    },
  });
};


// ─── INVOICES ─────────────────────────────────────────────
export const useInvoices = () =>
  useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`*, clients(name), projects(title)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useInvoice = (id) =>
  useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`*, clients(*), projects(*), invoice_items(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

export const useUpsertInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoice, items }) => {
      const { data, error } = invoice.id
        ? await supabase.from('invoices').update(invoice).eq('id', invoice.id).select().single()
        : await supabase.from('invoices').insert(invoice).select().single();
      if (error) throw error;

      if (items && items.length > 0) {
        await supabase.from('invoice_items').delete().eq('invoice_id', data.id);
        await supabase.from('invoice_items').insert(
          items.map(item => ({ ...item, invoice_id: data.id }))
        );
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
};


// ─── DASHBOARD STATS ──────────────────────────────────────
export const useDashboardStats = () =>
  useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const [projects, invoices, labour] = await Promise.all([
        supabase.from('project_summary').select('*'),
        supabase.from('invoices').select('total, amount_paid, status'),
        supabase.from('labour_logs').select('amount, is_paid').eq('is_paid', false),
      ]);

      const activeProjects  = projects.data?.filter(p => p.status === 'active').length ?? 0;
      const totalRevenue    = projects.data?.reduce((s, p) => s + (p.total_value ?? 0), 0) ?? 0;
      const totalProfit     = projects.data?.reduce((s, p) => s + (p.estimated_profit ?? 0), 0) ?? 0;
      const pendingPayments = labour.data?.reduce((s, l) => s + (l.amount ?? 0), 0) ?? 0;
      const unpaidInvoices  = invoices.data?.filter(i => i.status !== 'paid').length ?? 0;

      return { activeProjects, totalRevenue, totalProfit, pendingPayments, unpaidInvoices };
    },
  });


// ─── WEEKLY SHEETS ─────────────────────────────────────────
export const useWeeklySheets = (projectId) =>
  useQuery({
    queryKey: ['weekly_sheets', projectId],
    queryFn: async () => {
      let q = supabase
        .from('weekly_sheet_summary')
        .select('*')
        .order('week_start', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const useUpsertWeeklySheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sheet) => {
      const { data, error } = sheet.id
        ? await supabase.from('weekly_sheets').update(sheet).eq('id', sheet.id).select().single()
        : await supabase.from('weekly_sheets').insert(sheet).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weekly_sheets'] }),
  });
};

export const useDeleteWeeklySheet = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('weekly_sheets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weekly_sheets'] }),
  });
};


// ─── MATERIAL COSTS ────────────────────────────────────────
export const useAddMaterialCostFull = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cost) => {
      const { data, error } = await supabase
        .from('material_costs').insert(cost).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['material_costs', v.project_id] });
      qc.invalidateQueries({ queryKey: ['project_summary'] });
    },
  });
};

export const useUpdateMaterialCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cost) => {
      const { data, error } = await supabase
        .from('material_costs').update(cost).eq('id', cost.id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['material_costs', v.project_id] }),
  });
};

export const useDeleteMaterialCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }) => {
      const { error } = await supabase.from('material_costs').delete().eq('id', id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['material_costs', data.projectId] }),
  });
};

// ─── CLIENT PAYMENTS ───────────────────────────────────────
export const useClientPayments = (projectId) =>
  useQuery({
    queryKey: ['client_payments', projectId],
    queryFn: async () => {
      let q = supabase
        .from('client_payments')
        .select('*, projects(title), clients(name)')
        .order('payment_date', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const useAddClientPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment) => {
      const { data, error } = await supabase
        .from('client_payments').insert(payment).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['client_payments', v.project_id] });
      qc.invalidateQueries({ queryKey: ['project_payment_summary'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
  });
};

export const useDeleteClientPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }) => {
      const { error } = await supabase.from('client_payments').delete().eq('id', id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['client_payments', data.projectId] }),
  });
};

export const useProjectPaymentSummary = (projectId) =>
  useQuery({
    queryKey: ['project_payment_summary', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_payment_summary')
        .select('*')
        .eq('project_id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });


// ─── QUOTATIONS ────────────────────────────────────────────
export const useQuotations = (projectId) =>
  useQuery({
    queryKey: ['quotations', projectId],
    queryFn: async () => {
      let q = supabase
        .from('quotations')
        .select('*, clients(name,phone,address), projects(title,location)')
        .order('created_at', { ascending: false });
      if (projectId) q = q.eq('project_id', projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const useQuotation = (id) =>
  useQuery({
    queryKey: ['quotations', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, clients(*), projects(*), quotation_items(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

export const useUpsertQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ quotation, items }) => {
      const { data, error } = quotation.id
        ? await supabase.from('quotations').update(quotation).eq('id', quotation.id).select().single()
        : await supabase.from('quotations').insert(quotation).select().single();
      if (error) throw error;

      await supabase.from('quotation_items').delete().eq('quotation_id', data.id);
      if (items?.length) {
        await supabase.from('quotation_items').insert(
          items.map((item, i) => ({ ...item, quotation_id: data.id, sort_order: i }))
        );
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
};

export const useDeleteQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
};


// ─── RATE MASTER ───────────────────────────────────────────
export const useRateMaster = (category) =>
  useQuery({
    queryKey: ['rate_master', category],
    queryFn: async () => {
      let q = supabase
        .from('rate_master')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (category) q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const useUpsertRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rate) => {
      const { data, error } = rate.id
        ? await supabase.from('rate_master').update(rate).eq('id', rate.id).select().single()
        : await supabase.from('rate_master').insert(rate).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate_master'] }),
  });
};

export const useDeleteRate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('rate_master').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rate_master'] }),
  });
};
