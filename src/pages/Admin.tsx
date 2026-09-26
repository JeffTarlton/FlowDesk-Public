import { Shield, Users, Ticket, ChevronDown, Loader2, CheckCircle, AlertTriangle, Download, UserPlus, BarChart2, GitBranch, Eye, Key, Ban, UserCheck, Activity, Edit2, Trash2, Package, Timer } from 'lucide-react';
import NewUserModal from '../components/NewUserModal';
import EditUserModal from '../components/EditUserModal';
import { UserRole, Profile, Branch } from '../types';
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useAdminStore } from '../store/useAdminStore';
import { useProductStore } from '../store/useProductStore';
import { useSlaStore } from '../store/useSlaStore';
import { useApprovalStore } from '../store/useApprovalStore';

const ROLE_OPTIONS: UserRole[] = ['support_desk', 'developer', 'admin', 'branch_manager'];

const roleColors: Record<UserRole, string> = {
  support_desk: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  developer:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  branch_manager: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const priorityColors: Record<string, string> = {
  low:      'bg-green-100 text-green-700',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function Admin() {
  const { profile, impersonate } = useAuthStore();
  const { 
    users, tickets, branches, auditLogs, loadingUsers, loadingTickets, loadingBranches, loadingLogs,
    fetchUsers, fetchTickets, fetchBranches, fetchAuditLogs, updateUserRole, updateTicketStatus, updateUserFlags, deleteUser,
    createBranch, updateBranch, deleteBranch, forcePasswordReset
  } = useAdminStore();

  const [activeTab, setActiveTab] = useState<'users' | 'tickets' | 'analytics' | 'branches' | 'audit' | 'products' | 'sla' | 'gates'>('users');
  const { policies: slaPolicies, isLoading: loadingSla, fetchPolicies: fetchSlaPolicies, updatePolicy: updateSlaPolicy } = useSlaStore();
  const [editingSlaId, setEditingSlaId] = useState<string | null>(null);
  const [slaForm, setSlaForm] = useState({ response_time_hours: 0, resolution_time_hours: 0 });
  const { gates: approvalGates, isLoading: loadingGates, fetchGates: fetchApprovalGates, updateGate: updateApprovalGate, createGate: createApprovalGate, deleteGate: deleteApprovalGate } = useApprovalStore();
  const [showAddGate, setShowAddGate] = useState(false);
  const [newGateForm, setNewGateForm] = useState({ from_status: 'pending', to_status: 'ready_for_dev', requires_admin_approval: false, requires_customer_approval: false });
  const [globalView, setGlobalView] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [filterStuck, setFilterStuck] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [newBranchId, setNewBranchId] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  
  const { products, isLoading: loadingProducts, fetchProducts, createProduct, updateProduct, archiveProduct } = useProductStore();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', color: '#3b82f6' });

  const [resetPasswordUser, setResetPasswordUser] = useState<Profile | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchUsers();
    fetchTickets();
    fetchBranches();
    fetchAuditLogs();
    fetchProducts();
    fetchSlaPolicies();
    fetchApprovalGates();
  }, []);

  const statusOptions = [
    'pending', 'planning', 'ready_for_dev', 'dev_in_progress',
    'in_review', 'beta_testing', 'done'
  ];
  const statusLabels: Record<string, string> = {
    pending: 'Pending', planning: 'Planning', ready_for_dev: 'Ready for Dev',
    dev_in_progress: 'Dev in Progress', in_review: 'In Review',
    beta_testing: 'Beta Testing', done: 'Done',
  };

  const isTicketStuck = (updatedAt: string, status: string) => {
    if (status === 'done') return false;
    const diffTime = new Date().getTime() - new Date(updatedAt).getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    return diffDays > 5;
  };

  const handleExportCSV = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      if (activeTab === 'users') {
        csvContent += "ID,Name,Email,Role,Created At\n";
        users.forEach(u => {
          csvContent += `"${u.id}","${u.full_name || ''}","${u.email}","${u.role}","${u.created_at}"\n`;
        });
      } else {
        csvContent += "ID,Readable ID,Title,Type,Priority,Status,Customer Email,Created At,Last Updated,Is Stuck\n";
        tickets.forEach(t => {
          const stuck = isTicketStuck(t.updated_at, t.status) ? 'Yes' : 'No';
          csvContent += `"${t.id}","${t.readable_id}","${t.title.replace(/"/g, '""')}","${t.type}","${t.priority}","${t.status}","${t.customer_email || ''}","${t.created_at}","${t.updated_at}","${stuck}"\n`;
        });
      }
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `flowdesk_${activeTab}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`${activeTab === 'users' ? 'Users' : 'Tickets'} exported successfully`, 'success');
    } catch {
      showToast('Failed to export CSV', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-white font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.message}
        </div>
      )}

      {showNewUser && (
        <NewUserModal 
          onClose={() => setShowNewUser(false)} 
          onSuccess={() => {
            setShowNewUser(false);
            showToast('User created successfully!', 'success');
            fetchUsers();
          }} 
        />
      )}

      {editingUser && (
        <EditUserModal 
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            showToast('User updated successfully!', 'success');
            fetchUsers();
          }} 
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Shield size={20} className="text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        </div>
        <p className="text-gray-500 ml-13">Manage users, roles, and all tickets across the system.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <div className="text-sm text-gray-400 mb-1">Total Users</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{users.length}</div>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <div className="text-sm text-gray-400 mb-1">Open Tickets</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {tickets.filter(t => t.status !== 'done').length}
          </div>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-red-100 dark:border-red-900/30 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-bl-full -z-10" />
          <div className="text-sm text-red-500 dark:text-red-400 font-semibold mb-1">SLA Breached</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-500">
            {tickets.filter(t => t.status !== 'done' && (
              (t.sla_resolution_deadline && new Date(t.sla_resolution_deadline) < new Date()) ||
              t.sla_response_breached || t.sla_resolution_breached
            )).length}
          </div>
        </div>
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-green-100 dark:border-green-900/30 p-5">
          <div className="text-sm text-green-600 dark:text-green-400 font-semibold mb-1">SLA Compliance</div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-500">
            {tickets.length > 0
              ? Math.round(((tickets.filter(t => !t.sla_response_breached && !t.sla_resolution_breached).length) / tickets.length) * 100)
              : 100}%
          </div>
        </div>
      </div>

      {/* Tabs & Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} /> Users
          </button>
          <button
            onClick={() => { setActiveTab('tickets'); setFilterStuck(false); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'tickets'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Ticket size={16} /> All Tickets
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart2 size={16} /> Analytics
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'branches'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <GitBranch size={16} /> Branches
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Activity size={16} /> Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'products'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package size={16} /> Products
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'sla'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Timer size={16} /> SLA
          </button>
          <button
            onClick={() => setActiveTab('gates')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'gates'
                ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shield size={16} /> Gates
          </button>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'analytics' && profile?.role === 'branch_manager' && (
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl items-center mr-2">
              <button
                onClick={() => setGlobalView(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!globalView ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}
              >
                My Branch
              </button>
              <button
                onClick={() => setGlobalView(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${globalView ? 'bg-white dark:bg-surface-dark text-gray-900 dark:text-white shadow-sm' : 'text-gray-400'}`}
              >
                Global
              </button>
            </div>
          )}
          {activeTab === 'users' && (
            <button
              onClick={() => setShowNewUser(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
            >
              <UserPlus size={16} /> Invite User
            </button>
          )}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Download size={16} /> Export to CSV
          </button>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary-500" size={32} />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Company</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Branch</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Change Role</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold uppercase text-xs">
                          {(user.full_name || user.email || '?').charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium flex items-center gap-2">
                            <span className={user.is_active === false ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}>
                              {user.full_name || '—'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white text-sm font-medium">{user.company_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white text-sm font-medium">{user.branch_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${roleColors[user.role]}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            value={ROLE_OPTIONS.includes(user.role) ? user.role : ''}
                            onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                            className="appearance-none pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                          >
                            <option value="" disabled>Select a role</option>
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Edit User Info"
                          onClick={() => setEditingUser(user)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          title="Impersonate User"
                          onClick={() => {
                            impersonate(user);
                            showToast(`Impersonating ${user.full_name || user.email}`, 'success');
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          title={user.force_password_reset ? "Password Reset Pending" : "Force Password Reset"}
                          onClick={() => {
                            if (user.force_password_reset) {
                              updateUserFlags(user.id, { force_password_reset: false });
                            } else {
                              setResetPasswordUser(user);
                              setTempPassword('');
                              setResetError(null);
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors ${user.force_password_reset ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                        >
                          <Key size={16} />
                        </button>
                        <button
                          title={user.is_active === false ? "Reactivate User" : "Deactivate User"}
                          onClick={() => updateUserFlags(user.id, { is_active: user.is_active === false ? true : false })}
                          className={`p-1.5 rounded-md transition-colors ${user.is_active === false ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                        >
                          {user.is_active === false ? <UserCheck size={16} /> : <Ban size={16} />}
                        </button>
                        <button
                          title="Permanently Delete User"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone. Any tickets they are assigned to will become unassigned.')) {
                              deleteUser(user.id);
                            }
                          }}
                          className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-gray-400">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {filterStuck && (
            <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-semibold text-sm">
                <AlertTriangle size={18} />
                Showing "At Risk" Tickets (No updates for &gt;5 Days)
              </div>
              <button 
                onClick={() => setFilterStuck(false)}
                className="text-sm font-semibold text-orange-600 hover:text-orange-800 dark:text-orange-300 dark:hover:text-orange-100 transition-colors bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 px-3 py-1.5 rounded-lg"
              >
                Clear Filter
              </button>
            </div>
          )}
          <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            {loadingTickets ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary-500" size={32} />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">ID</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Title</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Priority</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {tickets
                  .filter(t => filterStuck ? isTicketStuck(t.updated_at, t.status) : true)
                  .map((ticket) => {
                  const isStuck = isTicketStuck(ticket.updated_at, ticket.status);
                  return (
                    <tr key={ticket.id} className={`hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors ${isStuck ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-bold text-primary-600 dark:text-primary-400">{ticket.readable_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium line-clamp-1 ${isStuck ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                            {ticket.title}
                          </span>
                          {isStuck && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 uppercase tracking-widest shrink-0">
                              Stuck
                            </span>
                          )}
                        </div>
                        {ticket.customer_email && (
                          <div className="text-xs text-gray-400 mt-0.5">{ticket.customer_email}</div>
                        )}
                      </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        ticket.type === 'bug'
                          ? 'bg-red-50 text-red-600 dark:bg-red-900/20'
                          : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20'
                      }`}>
                        {ticket.type === 'bug' ? 'Bug' : 'Feature'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${priorityColors[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block w-full max-w-[140px]">
                        <select
                          value={ticket.status}
                          onChange={(e) => updateTicketStatus(ticket.id, e.target.value)}
                          className={`appearance-none w-full pl-3 pr-8 py-1.5 border-none rounded-full text-xs font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 hover:opacity-90 ${
                            ticket.status === 'done'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                              : ticket.status === 'in_review' || ticket.status === 'beta_testing'
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                          }`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s} className="bg-white dark:bg-surface-dark text-gray-900 dark:text-white">{statusLabels[s]}</option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                           <svg className={`h-3 w-3 ${ticket.status === 'done' ? 'text-green-600 dark:text-green-400' : ticket.status === 'in_review' || ticket.status === 'beta_testing' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tickets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-gray-400">No tickets found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        </div>
      )}
      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-transparent p-4 rounded-2xl border border-green-100 dark:border-green-900/30 flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-500/20 group-hover:scale-110 transition-transform">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">SLA Health</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tickets.length > 0 ? Math.round(((tickets.length - tickets.filter(t => isTicketStuck(t.updated_at, t.status)).length) / tickets.length) * 100) : 100}%
                </div>
                <div className="text-[10px] text-gray-400">% compliant active/completed tickets</div>
              </div>
            </div>
            
            <div 
              onClick={() => { setActiveTab('tickets'); setFilterStuck(true); }}
              className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-transparent p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 flex items-center gap-4 group cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                <AlertTriangle size={24} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">At Risk</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tickets.filter(t => isTicketStuck(t.updated_at, t.status)).length}
                </div>
                <div className="text-[10px] text-gray-400">Tickets nearing breach</div>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('sla')}
              className="bg-gradient-to-br from-primary-500/10 to-primary-600/5 dark:from-primary-500/20 dark:to-transparent p-4 rounded-2xl border border-primary-100 dark:border-primary-900/30 flex items-center gap-4 group cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
                <Shield size={24} />
              </div>
              <div>
                <div className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-widest">SLA Rules</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{slaPolicies.length}</div>
                <div className="text-[10px] text-gray-400">Configure response &amp; resolution targets</div>
              </div>
            </div>
          </div>



        </div>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dynamic Branches</h2>
              <p className="text-sm text-gray-400">Manage the list of allowed branches across the entire system. Branch IDs are used to route tickets and provision branch managers.</p>
            </div>
            <button 
              onClick={() => setShowAddBranch(true)}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
            >
              Add Branch
            </button>
          </div>

          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {loadingBranches ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary-500" size={32} />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Branch ID</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Branch Name</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Created</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {branches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-gray-400">No branches found.</td>
                    </tr>
                  ) : (
                    branches.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{b.id}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-medium">{b.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {b.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(b.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              title="Edit Branch"
                              onClick={() => {
                                setEditingBranch(b);
                                setNewBranchId(b.id);
                                setNewBranchName(b.name);
                                setShowAddBranch(true);
                              }}
                              className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              title={b.is_active ? 'Deactivate Branch' : 'Activate Branch'}
                              onClick={() => updateBranch(b.id, { is_active: !b.is_active })}
                              className={`p-1.5 rounded-md transition-colors ${b.is_active ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                            >
                              {b.is_active ? <Ban size={16} /> : <UserCheck size={16} />}
                            </button>
                            <button
                              title="Delete Branch"
                              onClick={() => {
                                if (window.confirm(`Delete branch "${b.name}" (${b.id})? Tickets assigned to this branch will become unassigned.`)) {
                                  deleteBranch(b.id);
                                }
                              }}
                              className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Add Branch Modal */}
          {showAddBranch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{editingBranch ? 'Edit Branch' : 'Add New Branch'}</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newBranchId.trim() || !newBranchName.trim()) return;
                  
                  // The store actions show their own success / error toast
                  const saved = editingBranch
                    ? await updateBranch(editingBranch.id, { name: newBranchName.trim() })
                    : await createBranch(newBranchId.trim(), newBranchName.trim());
                  if (!saved) return;
                  
                  setNewBranchId('');
                  setNewBranchName('');
                  setEditingBranch(null);
                  setShowAddBranch(false);
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Branch ID <span className="text-red-500">*</span></label>
                    <input
                      required
                      disabled={!!editingBranch}
                      type="text"
                      placeholder="e.g. HQ or EAST-01"
                      value={newBranchId}
                      onChange={(e) => setNewBranchId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Branch Name <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Headquarters"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => { setShowAddBranch(false); setEditingBranch(null); setNewBranchId(''); setNewBranchName(''); }}
                      className="px-5 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors shadow-md"
                    >
                      {editingBranch ? 'Save Changes' : 'Create Branch'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">System Audit Logs</h2>
              <p className="text-sm text-gray-400">Review critical permission changes, manual deletions, and access revocations across the global system.</p>
            </div>
            <button onClick={fetchAuditLogs} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Refresh
            </button>
          </div>

          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary-500" size={32} />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Timestamp</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Action</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Actor</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Target / Entity</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-gray-400">No logs found.</td>
                    </tr>
                  ) : (
                    auditLogs.map(log => {
                      const dateStr = new Date(log.created_at).toLocaleString();
                      
                      let details = '—';
                      if (log.action === 'UPDATE_ROLE') {
                        details = `${log.old_data?.role} → ${log.new_data?.role}`;
                      } else if (log.action === 'DELETE' && log.entity_type === 'ticket') {
                        details = `Ticket: ${log.old_data?.title}`;
                      }

                      return (
                        <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-500">{dateStr}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${
                              log.action === 'DELETE' || log.action === 'DEACTIVATE' ? 'bg-red-100 text-red-700' :
                              log.action === 'ACTIVATE' ? 'bg-green-100 text-green-700' :
                              'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {log.actor_profile?.full_name || log.actor_profile?.email || log.actor_id}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {log.entity_type} ({log.target_id?.substring(0,8)}...)
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                            {details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Product Catalog Management</h2>
              <p className="text-sm text-gray-400">Manage the list of products that tickets can be linked to.</p>
            </div>
            <button 
              onClick={() => { setEditingProduct(null); setProductForm({ name: '', description: '', color: '#3b82f6' }); setShowAddProduct(true); }}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
            >
              Add Product
            </button>
          </div>

          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary-500" size={32} />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Product Name</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Description</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Color</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-gray-400">No products found.</td>
                    </tr>
                  ) : (
                    products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{p.description || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                             <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: p.color }}></div>
                             <span className="text-xs font-mono text-gray-500">{p.color}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            {p.status === 'active' ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              title="Edit Product"
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({ name: p.name, description: p.description || '', color: p.color || '#3b82f6' });
                                setShowAddProduct(true);
                              }}
                              className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              <Edit2 size={16} />
                            </button>
                            {p.status === 'active' && (
                              <button
                                title="Archive Product"
                                onClick={() => {
                                  if (window.confirm(`Archive product "${p.name}"? It will no longer be assignable to new tickets.`)) {
                                    archiveProduct(p.id);
                                  }
                                }}
                                className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                              >
                                <Ban size={16} />
                              </button>
                            )}
                            {p.status === 'archived' && (
                              <button
                                title="Reactivate Product"
                                onClick={() => updateProduct(p.id, { status: 'active' })}
                                className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Add/Edit Product Modal */}
          {showAddProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!productForm.name.trim()) return;
                  if (editingProduct) {
                    await updateProduct(editingProduct.id, { name: productForm.name.trim(), description: productForm.description.trim() || null, color: productForm.color });
                    showToast('Product updated!', 'success');
                  } else {
                    await createProduct(productForm.name.trim(), productForm.description.trim() || '', productForm.color);
                    showToast('Product created!', 'success');
                  }
                  setShowAddProduct(false);
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Name <span className="text-red-500">*</span></label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Mobile App"
                      value={productForm.name}
                      onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Description</label>
                    <input
                      type="text"
                      placeholder="Optional details"
                      value={productForm.description}
                      onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Theme Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={productForm.color}
                        onChange={(e) => setProductForm({...productForm, color: e.target.value})}
                        className="h-10 w-16 p-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer"
                      />
                      <div className="text-xs font-mono text-gray-500">{productForm.color}</div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setShowAddProduct(false)}
                      className="px-5 py-2.5 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold transition-colors shadow-md"
                    >
                      {editingProduct ? 'Save Changes' : 'Create Product'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SLA Policies Tab */}
      {activeTab === 'sla' && (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">SLA Policy Configuration</h2>
              <p className="text-sm text-gray-400">Define response and resolution time targets per ticket priority level.</p>
            </div>
          </div>

          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {loadingSla ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary-500" size={32} />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Priority</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Response Time (Hours)</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Resolution Time (Hours)</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {slaPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-gray-400">No SLA policies configured.</td>
                    </tr>
                  ) : (
                    slaPolicies.map(policy => {
                      const priorityBadge: Record<string, string> = {
                        critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                        medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      };
                      const isEditing = editingSlaId === policy.id;

                      return (
                        <tr key={policy.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${priorityBadge[policy.priority] || 'bg-gray-100 text-gray-600'}`}>
                              {policy.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={slaForm.response_time_hours}
                                onChange={(e) => setSlaForm({ ...slaForm, response_time_hours: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {policy.response_time_hours}h
                                <span className="text-gray-400 font-normal ml-1">
                                  ({policy.response_time_hours >= 24 ? `${Math.round(policy.response_time_hours / 24)}d` : `${policy.response_time_hours}h`})
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={slaForm.resolution_time_hours}
                                onChange={(e) => setSlaForm({ ...slaForm, resolution_time_hours: parseFloat(e.target.value) || 0 })}
                                className="w-24 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            ) : (
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {policy.resolution_time_hours}h
                                <span className="text-gray-400 font-normal ml-1">
                                  ({policy.resolution_time_hours >= 24 ? `${Math.round(policy.resolution_time_hours / 24)}d` : `${policy.resolution_time_hours}h`})
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${policy.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                              {policy.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingSlaId(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={async () => {
                                    await updateSlaPolicy(policy.id, {
                                      response_time_hours: slaForm.response_time_hours,
                                      resolution_time_hours: slaForm.resolution_time_hours,
                                    });
                                    setEditingSlaId(null);
                                  }}
                                  className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Save
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  title="Edit SLA Policy"
                                  onClick={() => {
                                    setEditingSlaId(policy.id);
                                    setSlaForm({
                                      response_time_hours: policy.response_time_hours,
                                      resolution_time_hours: policy.resolution_time_hours,
                                    });
                                  }}
                                  className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  title={policy.is_active ? 'Disable Policy' : 'Enable Policy'}
                                  onClick={() => updateSlaPolicy(policy.id, { is_active: !policy.is_active })}
                                  className={`p-1.5 rounded-md transition-colors ${policy.is_active ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20' : 'text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                >
                                  {policy.is_active ? <Ban size={16} /> : <CheckCircle size={16} />}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">How SLA Works</h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• <strong>Response Time:</strong> How long until a ticket first moves out of "Pending" status.</li>
              <li>• <strong>Resolution Time:</strong> How long from creation until a ticket reaches "Done".</li>
              <li>• Deadlines are auto-computed when a ticket is created, based on its priority.</li>
              <li>• If a ticket's priority changes, deadlines are recomputed automatically.</li>
              <li>• Breaches trigger in-app notifications to the assignee and all watchers.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Approval Gates Tab */}
      {activeTab === 'gates' && (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Approval Gates</h2>
              <p className="text-sm text-gray-400">Control which status transitions require admin or customer approval.</p>
            </div>
            <button
              onClick={() => setShowAddGate(!showAddGate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm"
            >
              {showAddGate ? 'Cancel' : '+ Add Gate'}
            </button>
          </div>

          {/* Add New Gate Form */}
          {showAddGate && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">New Approval Gate</h3>
              <div className="grid grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">From Status</label>
                  <select
                    value={newGateForm.from_status}
                    onChange={e => setNewGateForm({ ...newGateForm, from_status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="planning">Planning</option>
                    <option value="sow_in_progress">SOW In Progress</option>
                    <option value="awaiting_customer_approval">Awaiting Customer Approval</option>
                    <option value="ready_for_dev">Ready for Dev</option>
                    <option value="dev_in_progress">Dev In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="beta_testing">Beta Testing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">To Status</label>
                  <select
                    value={newGateForm.to_status}
                    onChange={e => setNewGateForm({ ...newGateForm, to_status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="planning">Planning</option>
                    <option value="sow_in_progress">SOW In Progress</option>
                    <option value="awaiting_customer_approval">Awaiting Customer Approval</option>
                    <option value="ready_for_dev">Ready for Dev</option>
                    <option value="dev_in_progress">Dev In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="beta_testing">Beta Testing</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={newGateForm.requires_admin_approval} onChange={e => setNewGateForm({ ...newGateForm, requires_admin_approval: e.target.checked })} className="w-3.5 h-3.5 rounded" />
                    <span className="text-gray-600 dark:text-gray-300">Admin Approval</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={newGateForm.requires_customer_approval} onChange={e => setNewGateForm({ ...newGateForm, requires_customer_approval: e.target.checked })} className="w-3.5 h-3.5 rounded" />
                    <span className="text-gray-600 dark:text-gray-300">Customer Approval</span>
                  </label>
                </div>
                <button
                  onClick={async () => {
                    if (newGateForm.from_status === newGateForm.to_status) {
                      showToast('From and To status must be different', 'error');
                      return;
                    }
                    await createApprovalGate(newGateForm as any);
                    setShowAddGate(false);
                    setNewGateForm({ from_status: 'pending', to_status: 'ready_for_dev', requires_admin_approval: false, requires_customer_approval: false });
                  }}
                  className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Create Gate
                </button>
              </div>
            </div>
          )}

          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {loadingGates ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-primary-500" size={32} />
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">From Status</th>
                    <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">&rarr;</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">To Status</th>
                    <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Admin Required</th>
                    <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Customer Required</th>
                    <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Active</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {approvalGates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-gray-400">No approval gates configured. All transitions are open.</td>
                    </tr>
                  ) : (
                    approvalGates.map(gate => {
                      const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <tr key={gate.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatStatus(gate.from_status)}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">&rarr;</td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatStatus(gate.to_status)}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => updateApprovalGate(gate.id, { requires_admin_approval: !gate.requires_admin_approval })}
                              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${gate.requires_admin_approval ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}
                            >
                              {gate.requires_admin_approval ? 'YES' : 'NO'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => updateApprovalGate(gate.id, { requires_customer_approval: !gate.requires_customer_approval })}
                              className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${gate.requires_customer_approval ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}
                            >
                              {gate.requires_customer_approval ? 'YES' : 'NO'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => updateApprovalGate(gate.id, { is_active: !gate.is_active })}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${gate.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                            >
                              {gate.is_active ? 'Active' : 'Off'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteApprovalGate(gate.id)}
                              className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete Gate"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">How Approval Gates Work</h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Gates define which status transitions require approvals before they can proceed.</li>
              <li>• <strong>Admin Required:</strong> The "Admin Approved" checkbox must be checked on the ticket.</li>
              <li>• <strong>Customer Required:</strong> The "Customer Approved" checkbox must be checked on the ticket.</li>
              <li>• Both Kanban drag-and-drop and the status dropdown enforce these gates.</li>
              <li>• Disable a gate to temporarily remove the restriction without deleting it.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Force Password Reset Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Force Password Reset</h3>
            <p className="text-sm text-gray-500 mb-6">
              You are about to reset the password for <strong>{resetPasswordUser.full_name || resetPasswordUser.email}</strong>. They will be forced to change it upon their next login.
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (tempPassword.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return;
              }
              try {
                setIsResetting(true);
                setResetError(null);
                await forcePasswordReset(resetPasswordUser.id, tempPassword);
                setResetPasswordUser(null);
              } catch (e: any) {
                setResetError(e.message || 'Failed to force password reset');
              } finally {
                setIsResetting(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Temporary Password <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  placeholder="e.g. ChangeMe123!"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400 leading-snug font-medium">
                    {resetError}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button 
                  type="button" 
                  onClick={() => setResetPasswordUser(null)}
                  className="px-4 py-2 rounded-xl font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isResetting || !tempPassword}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-colors shadow-md disabled:opacity-50"
                >
                  {isResetting ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
