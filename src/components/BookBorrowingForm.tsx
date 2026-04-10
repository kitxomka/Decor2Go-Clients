import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { BookBorrowing } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebase-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface BookBorrowingFormProps {
  record?: BookBorrowing;
  onClose: () => void;
}

export function BookBorrowingForm({ record, onClose }: BookBorrowingFormProps) {
  const [formData, setFormData] = useState<Partial<BookBorrowing>>({
    name: '',
    numberOfBooks: 1,
    bookNames: '',
    notes: '',
    phone: '',
    email: '',
    paid: false,
    back: false,
  });

  useEffect(() => {
    if (record) {
      setFormData(record);
    }
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = 'bookBorrowing';
    try {
      const now = Timestamp.now();
      const { id, ...dataToSave } = formData;
      
      if (record?.id) {
        await updateDoc(doc(db, path, record.id), {
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
      handleFirestoreError(error, record?.id ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4" data-testid="borrowing-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Borrower Name</Label>
          <Input 
            id="name" 
            value={formData.name} 
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
            required 
            data-testid="borrower-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="numberOfBooks">Number of Books</Label>
          <Input 
            id="numberOfBooks" 
            type="number"
            value={formData.numberOfBooks} 
            onChange={(e) => setFormData({ ...formData, numberOfBooks: parseInt(e.target.value) || 0 })} 
            required 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email" 
            type="email" 
            value={formData.email} 
            onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
            required 
            data-testid="borrower-email-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input 
            id="phone" 
            value={formData.phone} 
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="bookNames">Book Names</Label>
          <Textarea 
            id="bookNames" 
            value={formData.bookNames} 
            onChange={(e) => setFormData({ ...formData, bookNames: e.target.value })} 
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
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="paid" 
            checked={formData.paid} 
            onCheckedChange={(checked) => setFormData({ ...formData, paid: !!checked })} 
          />
          <Label htmlFor="paid">Paid</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="back" 
            checked={formData.back} 
            onCheckedChange={(checked) => setFormData({ ...formData, back: !!checked })} 
          />
          <Label htmlFor="back">Returned</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer" data-testid="borrowing-form-cancel">Cancel</Button>
        <Button type="submit" className="cursor-pointer" data-testid="borrowing-form-submit">{record ? 'Update Record' : 'Add Record'}</Button>
      </div>
    </form>
  );
}
