import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { Client, ClientCategory, InvoiceStatus, ProjectStatus } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClientFormProps {
  client?: Client;
  onClose: () => void;
}

export function ClientForm({ client, onClose }: ClientFormProps) {
  const [formData, setFormData] = useState<Partial<Client>>({
    category: 'private',
    name: '',
    email: '',
    phone: '',
    address: '',
    measurements: '',
    skuSent: '',
    skuOrderedPrinted: '',
    invoiceNumber: '',
    invoiceStatus: 'pending',
    notes: '',
    projectStatus: 'design_selection',
    installationDate: null,
    parentClientId: '',
    projectName: '',
    nextStep: '',
  });

  useEffect(() => {
    if (client) {
      // Convert Timestamp to date string for the input
      const data = { ...client };
      if (data.installationDate instanceof Timestamp) {
        // Use local date components to avoid timezone shifts
        const d = data.installationDate.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        // @ts-ignore - we're temporarily storing string in the Partial<Client> for the input
        data.installationDate = `${year}-${month}-${day}`;
      }
      setFormData(data);
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'clients';
    try {
      const now = Timestamp.now();
      const { id, ...dataToSave } = formData;
      
      // Ensure installationDate is handled correctly if it's a string from the input
      if (typeof dataToSave.installationDate === 'string' && dataToSave.installationDate) {
        // Parse the YYYY-MM-DD string as local midnight to avoid timezone shifts
        const [year, month, day] = dataToSave.installationDate.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        dataToSave.installationDate = Timestamp.fromDate(localDate);
      } else if (!dataToSave.installationDate) {
        dataToSave.installationDate = null;
      }

      if (client?.id) {
        await updateDoc(doc(db, path, client.id), {
          ...dataToSave,
          updatedAt: now,
        });
      } else {
        await addDoc(collection(db, path), {
          ...dataToSave,
          createdAt: now,
          updatedAt: now,
        });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, client?.id ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4" data-testid="client-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">{formData.category === 'private' ? 'Client Name' : 'Company / Designer Name'}</Label>
          <Input 
            id="name" 
            value={formData.name} 
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
            required 
            data-testid="client-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select 
            value={formData.category} 
            onValueChange={(value: ClientCategory) => {
              const updates: Partial<Client> = { category: value, parentClientId: '' };
              if (value === 'private') {
                updates.projectName = '';
              }
              setFormData({ ...formData, ...updates });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="designer">Designer</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(formData.category === 'designer' || formData.category === 'commercial') && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="projectName">Project Name (Optional)</Label>
            <Input 
              id="projectName" 
              placeholder="e.g. Living Room, Master Suite"
              value={formData.projectName || ''} 
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} 
            />
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nextStep">Next Step</Label>
          <Input 
            id="nextStep" 
            placeholder="e.g. Follow up on Tuesday"
            value={formData.nextStep || ''} 
            onChange={(e) => setFormData({ ...formData, nextStep: e.target.value })} 
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email" 
            type="email" 
            value={formData.email} 
            onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
            required 
            data-testid="client-email-input"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="phone">Phone</Label>
          <Input 
            id="phone" 
            value={formData.phone} 
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input 
            id="address" 
            value={formData.address} 
            onChange={(e) => setFormData({ ...formData, address: e.target.value })} 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="skuSent">SKU Sent</Label>
          <Input 
            id="skuSent" 
            value={formData.skuSent} 
            onChange={(e) => setFormData({ ...formData, skuSent: e.target.value })} 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="skuOrderedPrinted">SKU Ordered/Printed</Label>
          <Input 
            id="skuOrderedPrinted" 
            value={formData.skuOrderedPrinted} 
            onChange={(e) => setFormData({ ...formData, skuOrderedPrinted: e.target.value })} 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoiceNumber">Invoice Number</Label>
          <Input 
            id="invoiceNumber" 
            value={formData.invoiceNumber} 
            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoiceStatus">Invoice Status</Label>
          <Select 
            value={formData.invoiceStatus} 
            onValueChange={(value: InvoiceStatus) => setFormData({ ...formData, invoiceStatus: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectStatus">Project Status</Label>
          <Select 
            value={formData.projectStatus} 
            onValueChange={(value: ProjectStatus) => setFormData({ ...formData, projectStatus: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
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
        <div className="space-y-2">
          <Label htmlFor="installationDate">Installation Date</Label>
          <Input 
            id="installationDate" 
            type="date"
            value={typeof formData.installationDate === 'string' ? formData.installationDate : ''} 
            onChange={(e) => setFormData({ ...formData, installationDate: e.target.value as any })} 
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="measurements">Measurements</Label>
          <Textarea 
            id="measurements" 
            value={formData.measurements} 
            onChange={(e) => setFormData({ ...formData, measurements: e.target.value })} 
            rows={3}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea 
            id="notes" 
            value={formData.notes} 
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer" data-testid="client-form-cancel">Cancel</Button>
        <Button type="submit" className="cursor-pointer" data-testid="client-form-submit">{client ? 'Update Client' : 'Add Client'}</Button>
      </div>
    </form>
  );
}
