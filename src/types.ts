import { Timestamp } from 'firebase/firestore';

export type ClientCategory = 'private' | 'designer' | 'commercial';

export type InvoiceStatus = 'pending' | 'paid' | 'canceled' | 'deposit';

export type ProjectStatus = 
  | 'design_selection' 
  | 'measurements' 
  | 'invoice_sent' 
  | 'order_print' 
  | 'received_contacted' 
  | 'ready_for_installation' 
  | 'waiting_for_installation'
  | 'completed';

export type OrderStatus = 'none' | 'ordered' | 'received';

export interface Client {
  id?: string;
  category: ClientCategory;
  name: string;
  email: string;
  phone: string;
  address: string;
  measurements: string;
  skuSent: string;
  skuOrderedPrinted: string;
  invoiceNumber: string;
  invoiceStatus: InvoiceStatus;
  notes: string;
  projectStatus: ProjectStatus;
  orderStatus?: OrderStatus;
  installationDate?: Timestamp | null;
  parentClientId?: string;
  projectName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BookBorrowing {
  id?: string;
  name: string;
  numberOfBooks: number;
  bookNames: string;
  notes: string;
  phone: string;
  email: string;
  paid: boolean;
  back: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Order {
  id?: string;
  orderDate: Timestamp;
  invoiceNumber: string;
  clientName: string;
  status: OrderStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
