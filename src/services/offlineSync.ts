import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private db: SQLiteDBConnection | null = null;
  private syncInProgress = new BehaviorSubject<boolean>(false);
  private lastSyncTime = new BehaviorSubject<Date | null>(null);

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    this.db = await sqlite.createConnection(
      'apparel_flow_db',
      false,
      'no-encryption',
      1,
      false
    );

    await this.db.open();
    await this.createTables();
  }

  private async createTables() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        address TEXT,
        sync_status TEXT DEFAULT 'pending'
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        order_date TEXT,
        total_amount REAL,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (customer_id) REFERENCES customers (id)
      )`,
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        quantity INTEGER,
        price REAL,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (order_id) REFERENCES orders (id)
      )`
    ];

    for (const query of queries) {
      await this.db?.execute(query);
    }
  }

  // Save customer offline
  async saveCustomerOffline(customer: any) {
    const query = `INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)`;
    await this.db?.run(query, [customer.name, customer.phone, customer.address]);
  }

  // Save order offline
  async saveOrderOffline(order: any) {
    const query = `INSERT INTO orders (customer_id, order_date, total_amount) VALUES (?, ?, ?)`;
    const result = await this.db?.run(query, [order.customer_id, order.order_date, order.total_amount]);
    return result?.lastId;
  }

  // Save order items offline
  async saveOrderItemsOffline(orderItems: any[]) {
    for (const item of orderItems) {
      const query = `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`;
      await this.db?.run(query, [item.order_id, item.product_id, item.quantity, item.price]);
    }
  }

  // Sync data with server
  async syncData() {
    if (this.syncInProgress.value) return;

    try {
      this.syncInProgress.next(true);

      // Check if current time is within sync window (7:30 AM to 5:30 PM)
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      const startTime = 7 * 60 + 30; // 7:30 AM in minutes
      const endTime = 17 * 60 + 30;  // 5:30 PM in minutes
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      if (currentTimeInMinutes < startTime || currentTimeInMinutes > endTime) {
        console.log('Outside sync window');
        return;
      }

      // Get all pending records
      const pendingCustomers = await this.db?.query('SELECT * FROM customers WHERE sync_status = ?', ['pending']);
      const pendingOrders = await this.db?.query('SELECT * FROM orders WHERE sync_status = ?', ['pending']);
      const pendingOrderItems = await this.db?.query('SELECT * FROM order_items WHERE sync_status = ?', ['pending']);

      // TODO: Implement your API calls here to sync with server
      // After successful sync, update sync_status to 'synced'
      
      this.lastSyncTime.next(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress.next(false);
    }
  }

  // Start periodic sync
  startPeriodicSync() {
    // Sync every 3 hours
    setInterval(() => this.syncData(), 3 * 60 * 60 * 1000);
  }
} 