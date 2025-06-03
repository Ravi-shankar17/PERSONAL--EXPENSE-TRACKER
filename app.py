import sqlite3
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

# Database initialization
def init_db():
    with sqlite3.connect('expenses.db') as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS expenses
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      date TEXT,
                      category TEXT,
                      amount REAL,
                      description TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS categories
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      name TEXT UNIQUE)''')
        c.execute('''CREATE TABLE IF NOT EXISTS budgets
                     (id INTEGER PRIMARY KEY AUTOINCREMENT,
                      category TEXT,
                      amount REAL,
                      month TEXT)''')
        # Insert default categories
        default_categories = ['Food', 'Transport', 'Utilities', 'Entertainment', 'Other']
        for cat in default_categories:
            try:
                c.execute("INSERT INTO categories (name) VALUES (?)", (cat,))
            except sqlite3.IntegrityError:
                pass
        conn.commit()

# Initialize database on startup
init_db()

# Helper function to get database connection
def get_db():
    conn = sqlite3.connect('expenses.db')
    conn.row_factory = sqlite3.Row
    return conn

# API Endpoints

# Add or edit expense
@app.route('/api/expense', methods=['POST'])
def add_expense():
    data = request.json
    expense_id = data.get('id')
    date = data['date']
    category = data['category']
    amount = float(data['amount'])
    description = data['description']
    
    with get_db() as conn:
        c = conn.cursor()
        if expense_id:
            # Update existing expense
            c.execute("UPDATE expenses SET date=?, category=?, amount=?, description=? WHERE id=?",
                      (date, category, amount, description, expense_id))
        else:
            # Add new expense
            c.execute("INSERT INTO expenses (date, category, amount, description) VALUES (?, ?, ?, ?)",
                      (date, category, amount, description))
        conn.commit()
    return jsonify({'status': 'success'})

# Get all expenses
@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM expenses ORDER BY date DESC")
        expenses = [dict(row) for row in c.fetchall()]
    return jsonify(expenses)

# Delete expense
@app.route('/api/expense/<int:id>', methods=['DELETE'])
def delete_expense(id):
    with get_db() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM expenses WHERE id=?", (id,))
        conn.commit()
    return jsonify({'status': 'success'})

# Get all categories
@app.route('/api/categories', methods=['GET'])
def get_categories():
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT name FROM categories")
        categories = [row['name'] for row in c.fetchall()]
    return jsonify(categories)

# Add new category
@app.route('/api/category', methods=['POST'])
def add_category():
    data = request.json
    name = data['name']
    with get_db() as conn:
        c = conn.cursor()
        try:
            c.execute("INSERT INTO categories (name) VALUES (?)", (name,))
            conn.commit()
            return jsonify({'status': 'success'})
        except sqlite3.IntegrityError:
            return jsonify({'status': 'error', 'message': 'Category already exists'}), 400

# Set or update budget
@app.route('/api/budget', methods=['POST'])
def set_budget():
    data = request.json
    category = data['category']
    amount = float(data['amount'])
    month = data['month']  # Format: YYYY-MM
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT id FROM budgets WHERE category=? AND month=?", (category, month))
        existing = c.fetchone()
        if existing:
            c.execute("UPDATE budgets SET amount=? WHERE id=?", (amount, existing['id']))
        else:
            c.execute("INSERT INTO budgets (category, amount, month) VALUES (?, ?, ?)",
                      (category, amount, month))
        conn.commit()
    return jsonify({'status': 'success'})

# Get budgets for a month
@app.route('/api/budgets/<month>', methods=['GET'])
def get_budgets(month):
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM budgets WHERE month=?", (month,))
        budgets = [dict(row) for row in c.fetchall()]
    return jsonify(budgets)

# Get spending report
@app.route('/api/report/<month>', methods=['GET'])
def get_report(month):
    with get_db() as conn:
        c = conn.cursor()
        # Get total spending per category
        c.execute("SELECT category, SUM(amount) as total FROM expenses WHERE strftime('%Y-%m', date)=? GROUP BY category", (month,))
        spending = {row['category']: row['total'] for row in c.fetchall()}
        # Get budgets
        c.execute("SELECT category, amount FROM budgets WHERE month=?", (month,))
        budgets = {row['category']: row['amount'] for row in c.fetchall()}
        # Combine data
        report = []
        for category in set(list(spending.keys()) + list(budgets.keys())):
            report.append({
                'category': category,
                'spent': spending.get(category, 0),
                'budget': budgets.get(category, 0)
            })
    return jsonify(report)

# Serve the frontend
@app.route('/')
def index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    app.run(debug=True)