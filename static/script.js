document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadExpenses();
    loadCurrentMonth();
    setupEventListeners();
});

let chart = null;

function setupEventListeners() {
    // Expense form submission
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const expense = {
            id: document.getElementById('expenseId').value,
            date: document.getElementById('date').value,
            category: document.getElementById('category').value,
            amount: document.getElementById('amount').value,
            description: document.getElementById('description').value
        };
        await fetch('/api/expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expense)
        });
        resetExpenseForm();
        loadExpenses();
    });

    // Cancel edit
    document.getElementById('cancelEdit').addEventListener('click', resetExpenseForm);

    // Add category
    document.getElementById('addCategoryBtn').addEventListener('click', async () => {
        const name = prompt('Enter new category name:');
        if (name) {
            const response = await fetch('/api/category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (response.ok) {
                loadCategories();
            } else {
                alert('Category already exists or invalid name.');
            }
        }
    });

    // Budget form submission
    document.getElementById('budgetForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const budget = {
            category: document.getElementById('budgetCategory').value,
            amount: document.getElementById('budgetAmount').value,
            month: document.getElementById('budgetMonth').value
        };
        await fetch('/api/budget', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(budget)
        });
        document.getElementById('budgetForm').reset();
    });

    // Generate report
    document.getElementById('generateReport').addEventListener('click', generateReport);
}

async function loadCategories() {
    const response = await fetch('/api/categories');
    const categories = await response.json();
    const categorySelect = document.getElementById('category');
    const budgetCategorySelect = document.getElementById('budgetCategory');
    categorySelect.innerHTML = '';
    budgetCategorySelect.innerHTML = '';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
        budgetCategorySelect.appendChild(option.cloneNode(true));
    });
}

async function loadExpenses() {
    const response = await fetch('/api/expenses');
    const expenses = await response.json();
    const tbody = document.getElementById('expensesBody');
    tbody.innerHTML = '';
    expenses.forEach(exp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${exp.date}</td>
            <td>${exp.category}</td>
            <td>$${parseFloat(exp.amount).toFixed(2)}</td>
            <td>${exp.description}</td>
            <td>
                <button onclick="editExpense(${exp.id})">Edit</button>
                <button onclick="deleteExpense(${exp.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function editExpense(id) {
    const response = await fetch('/api/expenses');
    const expenses = await response.json();
    const expense = expenses.find(exp => exp.id === id);
    document.getElementById('expenseId').value = expense.id;
    document.getElementById('date').value = expense.date;
    document.getElementById('category').value = expense.category;
    document.getElementById('amount').value = expense.amount;
    document.getElementById('description').value = expense.description;
    document.getElementById('cancelEdit').style.display = 'inline';
}

async function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        await fetch(`/api/expense/${id}`, { method: 'DELETE' });
        loadExpenses();
    }
}

function resetExpenseForm() {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('cancelEdit').style.display = 'none';
}

function loadCurrentMonth() {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('budgetMonth').value = month;
    document.getElementById('reportMonth').value = month;
}

async function generateReport() {
    const month = document.getElementById('reportMonth').value;
    const response = await fetch(`/api/report/${month}`);
    const report = await response.json();
    const tbody = document.getElementById('reportBody');
    tbody.innerHTML = '';
    report.forEach(item => {
        const status = item.spent > item.budget ? 'Over Budget' : 'Within Budget';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.category}</td>
            <td>$${item.spent.toFixed(2)}</td>
            <td>$${item.budget.toFixed(2)}</td>
            <td>${status}</td>
        `;
        tbody.appendChild(tr);
    });

    // Update chart
    if (chart) chart.destroy();
    const ctx = document.getElementById('reportChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: report.map(item => item.category),
            datasets: [
                {
                    label: 'Spent',
                    data: report.map(item => item.spent),
                    backgroundColor: 'rgba(255, 99, 132, 0.5)'
                },
                {
                    label: 'Budget',
                    data: report.map(item => item.budget),
                    backgroundColor: 'rgba(54, 162, 235, 0.5)'
                }
            ]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}