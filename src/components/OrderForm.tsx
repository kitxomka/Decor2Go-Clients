import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Order, OrderStatus } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface OrderFormProps {
  order?: Order;
  onClose: () => void;
}

export function OrderForm({ order, onClose }: OrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    orderDate: order?.orderDate ? format(order.orderDate.toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    invoiceNumber: order?.invoiceNumber || '',
    clientName: order?.clientName || '',
    status: order?.status || 'none'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Parse the YYYY-MM-DD string as local midnight to avoid timezone shifts
      const [year, month, day] = formData.orderDate.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);

      const data = {
        orderDate: Timestamp.fromDate(localDate),
        invoiceNumber: formData.invoiceNumber,
        clientName: formData.clientName,
        status: formData.status,
        updatedAt: serverTimestamp(),
      };

      if (order?.id) {
        const orderRef = doc(db, 'orders', order.id);
        try {
          await updateDoc(orderRef, data);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
        }
        toast.success('Order updated successfully');
      } else {
        try {
          await addDoc(collection(db, 'orders'), {
            ...data,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'orders');
        }
        toast.success('Order added successfully');
      }
      onClose();
    } catch (error) {
      console.error('Error saving order:', error);
      // handleFirestoreError already throws, but toast can show a generic message if it fails before that
      if (!(error instanceof Error && error.message.includes('{"error"'))) {
        toast.error('Failed to save order');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="orderDate">Date</Label>
          <Input
            id="orderDate"
            type="date"
            required
            value={formData.orderDate}
            onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
            className="cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoiceNumber">Invoice Number</Label>
          <Input
            id="invoiceNumber"
            required
            value={formData.invoiceNumber}
            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
            placeholder="INV-001"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientName">Client Name</Label>
          <Input
            id="clientName"
            required
            value={formData.clientName}
            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Order Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value: OrderStatus) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="received">Received</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onClose}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
        >
          {loading ? 'Saving...' : order?.id ? 'Update Record' : 'Add Record'}
        </Button>
      </div>
    </form>
  );
}
