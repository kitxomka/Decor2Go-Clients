import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  deleteDoc, 
  doc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { Client, BookBorrowing, ClientCategory, InvoiceStatus, ProjectStatus } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Filter, Edit2, Trash2, User, Phone, Mail, FileText, CheckCircle2, XCircle, LogIn, LogOut, Copy, Calendar, AlertCircle } from 'lucide-react';
import { ClientForm } from './ClientForm';
import { BookBorrowingForm } from './BookBorrowingForm';
import { InvoiceStatusBadge, ProjectStatusBadge } from './StatusBadge';
import { Logo } from './Logo';
import { format } from 'date-fns';

export function Dashboard() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [borrowings, setBorrowings] = useState<BookBorrowing[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<boolean>(false);
  const [todayFilter, setTodayFilter] = useState<boolean>(false);

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isBorrowingDialogOpen, setIsBorrowingDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [editingBorrowing, setEditingBorrowing] = useState<BookBorrowing | undefined>();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<{ id: string, collection: string } | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setClients([]);
      setBorrowings([]);
      return;
    }

    const clientsQuery = query(collection(db, 'clients'), orderBy('updatedAt', 'desc'));
    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
      setClients(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'clients'));

    const borrowingsQuery = query(collection(db, 'bookBorrowing'), orderBy('updatedAt', 'desc'));
    const unsubscribeBorrowings = onSnapshot(borrowingsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookBorrowing));
      setBorrowings(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bookBorrowing'));

    return () => {
      unsubscribeClients();
      unsubscribeBorrowings();
    };
  }, [user]);

  const filteredClients = useMemo(() => {
    const filtered = clients.filter(client => {
      let matchesCategory = false;
      if (activeTab === 'all') {
        matchesCategory = true;
      } else if (activeTab === 'designer') {
        const isDesigner = client.category === 'designer';
        const parent = client.parentClientId ? clients.find(c => c.id === client.parentClientId) : null;
        const isLinkedToDesigner = parent?.category === 'designer';
        matchesCategory = isDesigner || isLinkedToDesigner;
      } else if (activeTab === 'commercial') {
        const isCommercial = client.category === 'commercial';
        const parent = client.parentClientId ? clients.find(c => c.id === client.parentClientId) : null;
        const isLinkedToCommercial = parent?.category === 'commercial';
        matchesCategory = isCommercial || isLinkedToCommercial;
      } else {
        matchesCategory = client.category === activeTab;
      }

      const matchesSearch = 
        (client.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (client.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (client.phone || '').includes(search) ||
        (client.invoiceNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (client.projectName || '').toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || client.invoiceStatus === statusFilter;
      const matchesProject = projectFilter === 'all' || client.projectStatus === projectFilter;

      let matchesTask = true;
      if (taskFilter) {
        matchesTask = (client.nextStep && client.nextStep.trim() !== '') || 
                     client.invoiceStatus === 'pending' || 
                     client.projectStatus !== 'completed';
      }

      let matchesToday = true;
      if (todayFilter) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const inThreeDays = new Date();
        inThreeDays.setDate(today.getDate() + 3);
        inThreeDays.setHours(23, 59, 59, 999);

        const hasNextStep = client.nextStep && client.nextStep.trim() !== '';
        const isPending = client.invoiceStatus === 'pending';
        
        let hasInstallationSoon = false;
        if (client.installationDate) {
          const instDate = client.installationDate.toDate();
          hasInstallationSoon = instDate >= today && instDate <= inThreeDays;
        }

        matchesToday = hasNextStep || isPending || hasInstallationSoon;
      }

      return matchesCategory && matchesSearch && matchesStatus && matchesProject && matchesTask && matchesToday;
    });

    // Sort: Completed projects at the bottom, group by parent, then by updatedAt desc
    return [...filtered].sort((a, b) => {
      // 1. Completed at bottom
      if (a.projectStatus === 'completed' && b.projectStatus !== 'completed') return 1;
      if (a.projectStatus !== 'completed' && b.projectStatus === 'completed') return -1;
      
      // 2. Group by parent (Designer/Commercial)
      const aParentId = a.parentClientId || a.id;
      const bParentId = b.parentClientId || b.id;
      
      if (aParentId !== bParentId) {
        // If they have different parents, sort by the parent's most recent activity
        // This is complex to calculate here, so let's just sort by parentId to keep them together
        return (aParentId || '').localeCompare(bParentId || '');
      }

      // 3. Within same group, parent (the designer/company) comes first
      if (!a.parentClientId && b.parentClientId) return -1;
      if (a.parentClientId && !b.parentClientId) return 1;

      const dateA = a.updatedAt?.toDate().getTime() || 0;
      const dateB = b.updatedAt?.toDate().getTime() || 0;
      return dateB - dateA;
    });
  }, [clients, activeTab, search, statusFilter, projectFilter, taskFilter, todayFilter]);

  const filteredBorrowings = useMemo(() => {
    return borrowings.filter(b => 
      (b.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.phone || '').includes(search)
    );
  }, [borrowings, search]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copySummary = (client: Client) => {
    const summary = [
      client.name,
      client.projectName ? `Project: ${client.projectName}` : '',
      client.measurements ? `Measurements: ${client.measurements}` : '',
      client.notes ? `Notes: ${client.notes}` : ''
    ].filter(Boolean).join('\n');
    copyToClipboard(summary);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full shadow-xl border-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4">
              <Logo className="h-24 w-24 mx-auto object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Decor2Go Clients</CardTitle>
            <p className="text-gray-500 mt-2">Please sign in to access the CRM system</p>
          </CardHeader>
          <CardContent className="pt-6">
            <Button 
              onClick={handleLogin} 
              className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <LogIn className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user.email?.toLowerCase() === 'victoria@decor2go.ca';

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full shadow-xl border-none">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-red-100 p-3 rounded-2xl w-fit mb-4">
              <XCircle className="text-red-600 h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Access Denied</CardTitle>
            <p className="text-gray-500 mt-2">
              Sorry, your account (<strong>{user.email}</strong>) does not have permission to access this application.
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <Button 
              onClick={handleLogout} 
              variant="outline"
              className="w-full h-12 text-lg border-gray-200 hover:bg-gray-50 transition-all"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDeleteClick = (id: string, collectionName: string) => {
    setDeletingId({ id, collection: collectionName });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, deletingId.collection, deletingId.id));
      setIsDeleteDialogOpen(false);
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, deletingId.collection);
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsClientDialogOpen(true);
  };

  const handleEditBorrowing = (borrowing: BookBorrowing) => {
    setEditingBorrowing(borrowing);
    setIsBorrowingDialogOpen(true);
  };

  const handleAddProject = (parent: Client) => {
    setEditingClient({
      category: 'private',
      parentClientId: parent.id,
      name: '',
      email: '',
      phone: '',
      address: parent.address || '',
      projectStatus: 'design_selection',
      invoiceStatus: 'pending',
    } as any);
    setIsClientDialogOpen(true);
  };

  const resetClientDialog = () => {
    setEditingClient(undefined);
    setIsClientDialogOpen(false);
  };

  const resetBorrowingDialog = () => {
    setEditingBorrowing(undefined);
    setIsBorrowingDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="dashboard-root">
      {/* Header */}
      <header className="glass sticky top-0 z-10 border-b border-white/20" data-testid="dashboard-header">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="h-10 w-10 object-contain" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Decor2Go Clients</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-gray-500 hover:text-red-600 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto px-2 sm:px-4 lg:px-6 py-6" data-testid="dashboard-main">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" data-testid="dashboard-tabs">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center !gap-4">
              <TabsList className="bg-white/80 backdrop-blur-sm border border-gray-200/50 p-0 !h-[45px] w-fit flex items-center rounded-xl modern-shadow overflow-hidden shrink-0" data-testid="tabs-list">
                <TabsTrigger 
                  value="all" 
                  className="cursor-pointer px-5 h-full rounded-none transition-all hover:text-indigo-600 data-active:bg-indigo-50/40 data-active:text-indigo-700 data-active:shadow-[inset_0_-2px_0_0_theme(colors.indigo.600)] font-medium text-sm border-r border-gray-100 last:border-r-0"
                  data-testid="tab-all"
                >
                  All
                </TabsTrigger>
                <TabsTrigger 
                  value="private" 
                  className="cursor-pointer px-5 h-full rounded-none transition-all hover:text-indigo-600 data-active:bg-indigo-50/40 data-active:text-indigo-700 data-active:shadow-[inset_0_-2px_0_0_theme(colors.indigo.600)] font-medium text-sm border-r border-gray-100 last:border-r-0"
                  data-testid="tab-private"
                >
                  Private
                </TabsTrigger>
                <TabsTrigger 
                  value="designer" 
                  className="cursor-pointer px-5 h-full rounded-none transition-all hover:text-indigo-600 data-active:bg-indigo-50/40 data-active:text-indigo-700 data-active:shadow-[inset_0_-2px_0_0_theme(colors.indigo.600)] font-medium text-sm border-r border-gray-100 last:border-r-0"
                  data-testid="tab-designer"
                >
                  Designers
                </TabsTrigger>
                <TabsTrigger 
                  value="commercial" 
                  className="cursor-pointer px-5 h-full rounded-none transition-all hover:text-indigo-600 data-active:bg-indigo-50/40 data-active:text-indigo-700 data-active:shadow-[inset_0_-2px_0_0_theme(colors.indigo.600)] font-medium text-sm border-r border-gray-100 last:border-r-0"
                  data-testid="tab-commercial"
                >
                  Commercial
                </TabsTrigger>
                <TabsTrigger 
                  value="book_borrowing" 
                  className="cursor-pointer px-5 h-full rounded-none transition-all hover:text-indigo-600 data-active:bg-indigo-50/40 data-active:text-indigo-700 data-active:shadow-[inset_0_-2px_0_0_theme(colors.indigo.600)] font-medium text-sm border-r border-gray-100 last:border-r-0"
                  data-testid="tab-book-borrowing"
                >
                  Book Borrowing
                </TabsTrigger>
              </TabsList>

              {/* Search Container */}
              <div className="flex items-center bg-white/80 backdrop-blur-sm px-3 rounded-xl border border-gray-200/50 modern-shadow w-full md:w-[360px] !h-[45px] shrink-0" data-testid="search-section">
                <Search className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
                <Input 
                  placeholder="Search clients..." 
                  className="border-none bg-transparent shadow-none focus-visible:ring-0 p-0 h-full text-sm w-full placeholder:text-gray-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="search-input"
                />
              </div>

              {/* Filters Container */}
              {activeTab !== 'book_borrowing' && (
                <>
                  <div className="w-[220px] shrink-0">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="cursor-pointer !h-[45px] text-sm bg-white/80 backdrop-blur-sm border-gray-200/50 modern-shadow rounded-xl px-3 hover:bg-gray-50 transition-colors">
                        <span className="flex items-center gap-2 truncate">
                          <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-gray-500 font-medium shrink-0">Invoice status:</span>
                          <span className="truncate">
                            <SelectValue placeholder="All" />
                          </span>
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Invoices</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[220px] shrink-0">
                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                      <SelectTrigger className="cursor-pointer !h-[45px] text-sm bg-white/80 backdrop-blur-sm border-gray-200/50 modern-shadow rounded-xl px-3 hover:bg-gray-50 transition-colors">
                        <span className="flex items-center gap-2 truncate">
                          <Filter className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-gray-500 font-medium shrink-0">Project status:</span>
                          <span className="truncate">
                            <SelectValue placeholder="All" />
                          </span>
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        <SelectItem value="design_selection">Design Selection</SelectItem>
                        <SelectItem value="measurements">Measurements</SelectItem>
                        <SelectItem value="invoice_sent">Invoice Sent</SelectItem>
                        <SelectItem value="order_print">Order Print</SelectItem>
                        <SelectItem value="received_contacted">Received/Contacted</SelectItem>
                        <SelectItem value="ready_for_installation">Ready for Installation</SelectItem>
                        <SelectItem value="waiting_for_installation">Waiting for Installation</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {activeTab !== 'book_borrowing' && (
                <div className="flex items-center gap-2">
                  <Button 
                    variant={taskFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setTaskFilter(!taskFilter);
                      if (!taskFilter) setTodayFilter(false);
                    }}
                    className={`!h-[45px] px-4 rounded-xl modern-shadow transition-all cursor-pointer ${taskFilter ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent' : 'bg-white/80 border-gray-200/50 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Active Tasks
                  </Button>
                  <Button 
                    variant={todayFilter ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setTodayFilter(!todayFilter);
                      if (!todayFilter) setTaskFilter(false);
                    }}
                    className={`!h-[45px] px-4 rounded-xl modern-shadow transition-all cursor-pointer ${todayFilter ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent' : 'bg-white/80 border-gray-200/50 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Today
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2" data-testid="action-buttons">
              {activeTab === 'book_borrowing' ? (
                <Dialog open={isBorrowingDialogOpen} onOpenChange={setIsBorrowingDialogOpen}>
                  <DialogTrigger render={
                    <Button onClick={() => setEditingBorrowing(undefined)} className="bg-indigo-600 hover:bg-indigo-700 cursor-pointer" data-testid="add-borrowing-btn">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Record
                    </Button>
                  } />
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="borrowing-dialog">
                    <DialogHeader>
                      <DialogTitle>{editingBorrowing ? 'Edit Borrowing Record' : 'Add Borrowing Record'}</DialogTitle>
                    </DialogHeader>
                    <BookBorrowingForm record={editingBorrowing} onClose={resetBorrowingDialog} />
                  </DialogContent>
                </Dialog>
              ) : (
                <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
                  <DialogTrigger render={
                    <Button onClick={() => setEditingClient(undefined)} className="bg-indigo-600 hover:bg-indigo-700 cursor-pointer" data-testid="add-client-btn">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Client
                    </Button>
                  } />
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="client-dialog">
                    <DialogHeader>
                      <DialogTitle>{editingClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
                    </DialogHeader>
                    <ClientForm client={editingClient} onClose={resetClientDialog} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Client Tabs */}
          {['all', 'private', 'designer', 'commercial'].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-0" data-testid={`tab-content-${tab}`}>
              <div className="modern-card">
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table className="modern-table w-full table-auto" data-testid={`table-${tab}`}>
                    <TableHeader>
                      <TableRow className="bg-gray-50/30">
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[180px]">Name</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[150px]">Next Step</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[150px]">Contact</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[100px]">Invoice</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[140px]">Project Status</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[120px]">Installation</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[140px]">SKUs</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[150px]">Measurements</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[180px]">Notes</TableHead>
                        <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[100px]">Updated</TableHead>
                        <TableHead className="text-right font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 whitespace-nowrap">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="h-32 text-center text-gray-500">
                            No clients found matching your criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredClients.map((client) => (
                          <TableRow 
                            key={client.id} 
                            className="hover:bg-gray-50/80 transition-colors cursor-pointer group border-b border-gray-50 last:border-0"
                            onClick={() => handleEditClient(client)}
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <div className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors flex items-center flex-wrap gap-1 group/name-copy">
                                  {client.parentClientId ? (
                                    <>
                                      <span>{client.name}</span>
                                      <span className="mx-1 text-gray-400">/</span>
                                      <span className="text-indigo-600 font-semibold">
                                        {clients.find(c => c.id === client.parentClientId)?.name || 'Unknown'}
                                      </span>
                                    </>
                                  ) : (
                                    <span>{client.name}</span>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-4 w-4 ml-1 opacity-0 group-hover/name-copy:opacity-100 transition-opacity"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      copyToClipboard(client.name); 
                                    }}
                                    title="Copy Name"
                                  >
                                    <Copy className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                                {client.projectName && (
                                  <div className="mt-1">
                                    <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                      Project: {client.projectName}
                                    </span>
                                  </div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {client.address}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-indigo-700 bg-indigo-50/50 px-3 py-1 rounded-lg border border-indigo-100 min-h-[32px] flex items-center">
                                {client.nextStep || <span className="text-gray-300 italic text-[10px]">No next step</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 text-sm text-gray-600 break-words">
                                <div className="flex items-center gap-1 group/copy flex-wrap">
                                  <Mail className="h-3 w-3 mr-1.5 opacity-60" />
                                  <span className="truncate">{client.email}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-4 w-4 ml-1 opacity-0 group-hover/copy:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(client.email); }}
                                    title="Copy Email"
                                  >
                                    <Copy className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                                <div className="flex items-center group/copy">
                                  <Phone className="h-3 w-3 mr-1.5 opacity-60" />
                                  {client.phone}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <InvoiceStatusBadge status={client.invoiceStatus} />
                                <div className="text-xs font-mono text-gray-400 flex items-center group/copy">
                                  #{client.invoiceNumber || 'N/A'}
                                  {client.invoiceNumber && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-4 w-4 ml-1 opacity-0 group-hover/copy:opacity-100 transition-opacity"
                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(client.invoiceNumber); }}
                                      title="Copy Invoice Number"
                                    >
                                      <Copy className="h-2.5 w-2.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <ProjectStatusBadge status={client.projectStatus} />
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-600">
                                {client.installationDate ? format(client.installationDate.toDate(), 'MMM d, yy') : '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400 font-semibold">Sent:</span>
                                  <span className="text-gray-600">{client.skuSent || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400 font-semibold">Print:</span>
                                  <span className="text-gray-600">{client.skuOrderedPrinted || '-'}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-gray-600 relative group/copy">
                                {client.measurements || '-'}
                                {client.measurements && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 absolute -right-2 top-0 opacity-0 group-hover/copy:opacity-100 transition-opacity bg-white/90 shadow-sm"
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(client.measurements); }}
                                    title="Copy Measurements"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-gray-600">
                                {client.notes || '-'}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {format(client.updatedAt.toDate(), 'MMM d, yy')}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={(e) => { e.stopPropagation(); copySummary(client); }} 
                                  className="h-8 w-8 text-indigo-400 hover:text-indigo-600 cursor-pointer"
                                  title="Copy Summary"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={(e) => { e.stopPropagation(); handleEditClient(client); }} 
                                  className="h-8 w-8 text-gray-400 hover:text-indigo-600 cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(client.id!, 'clients'); }} 
                                  className="h-8 w-8 text-gray-400 hover:text-red-600 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden grid grid-cols-1 divide-y divide-gray-100">
                  {filteredClients.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No clients found.</div>
                  ) : (
                    filteredClients.map((client) => (
                      <div key={client.id} className="p-4 space-y-3 hover:bg-gray-50/80 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-gray-900 flex items-center group/name-copy">
                              {client.name}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-4 w-4 ml-1 opacity-60 hover:opacity-100"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  copyToClipboard(client.name); 
                                }}
                                title="Copy Name"
                              >
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                            {client.nextStep && (
                              <div className="mt-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 italic">
                                Next: {client.nextStep}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">{client.address}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => copySummary(client)} className="h-8 w-8 cursor-pointer text-indigo-500" title="Copy Summary">
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEditClient(client)} className="h-8 w-8 cursor-pointer">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(client.id!, 'clients')} className="h-8 w-8 text-red-500 cursor-pointer">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <InvoiceStatusBadge status={client.invoiceStatus} />
                          <ProjectStatusBadge status={client.projectStatus} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 pt-2 border-t border-gray-50">
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-2 opacity-60" />
                            <span className="truncate">{client.email}</span>
                          </div>
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-2 opacity-60" />
                            {client.phone}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          ))}

          {/* Book Borrowing Tab */}
          <TabsContent value="book_borrowing" className="mt-0" data-testid="tab-content-borrowing">
            <div className="modern-card overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <Table className="modern-table" data-testid="table-borrowing">
                  <TableHeader>
                    <TableRow className="bg-gray-50/30">
                      <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[150px]">Borrower</TableHead>
                      <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[200px]">Books</TableHead>
                      <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[120px]">Status</TableHead>
                      <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[150px]">Notes</TableHead>
                      <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 min-w-[120px]">Updated</TableHead>
                      <TableHead className="text-right font-semibold text-[10px] uppercase tracking-wider text-gray-500 py-4 sticky right-0 bg-white/95 backdrop-blur-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBorrowings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                          No borrowing records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBorrowings.map((b) => (
                        <TableRow 
                          key={b.id} 
                          className="hover:bg-gray-50/80 transition-colors cursor-pointer group border-b border-gray-50 last:border-0"
                          onClick={() => handleEditBorrowing(b)}
                        >
                          <TableCell>
                            <div className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">{b.name}</div>
                            <div className="text-xs text-gray-500">{b.email}</div>
                            <div className="text-xs text-gray-500">{b.phone}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-indigo-500" />
                              <span className="font-medium">{b.numberOfBooks} Books</span>
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{b.bookNames}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5">
                                {b.paid ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                <span className={b.paid ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>Paid</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {b.back ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                                <span className={b.back ? 'text-green-700 text-sm' : 'text-red-600 text-sm'}>Returned</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-600 line-clamp-2 max-w-[150px]">
                              {b.notes || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {format(b.updatedAt.toDate(), 'MMM d, yy')}
                          </TableCell>
                          <TableCell className="text-right sticky right-0 bg-white group-hover:bg-indigo-50/30">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={(e) => { e.stopPropagation(); handleEditBorrowing(b); }} 
                                className="h-8 w-8 text-gray-400 hover:text-indigo-600 cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(b.id!, 'bookBorrowing'); }} 
                                className="h-8 w-8 text-gray-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards for Borrowing */}
              <div className="md:hidden grid grid-cols-1 divide-y divide-gray-100">
                {filteredBorrowings.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No records found.</div>
                ) : (
                  filteredBorrowings.map((b) => (
                    <div key={b.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-gray-900">{b.name}</div>
                          <div className="text-xs text-gray-500 mt-1">{b.email}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditBorrowing(b)} className="h-8 w-8 cursor-pointer">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(b.id!, 'bookBorrowing')} className="h-8 w-8 text-red-500 cursor-pointer">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          {b.paid ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />}
                          <span>Paid</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {b.back ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-400" />}
                          <span>Returned</span>
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        <span className="font-semibold">{b.numberOfBooks} Books:</span> {b.bookNames}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="delete-dialog">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-600">Are you sure you want to delete this record? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="cursor-pointer" data-testid="delete-cancel-btn">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} className="cursor-pointer" data-testid="delete-confirm-btn">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
