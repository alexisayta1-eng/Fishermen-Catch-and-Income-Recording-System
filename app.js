/**
 * FCIRS System - Core Logic with LocalStorage Integration (No external DB)
 */

const App = {
    // Current User Session
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,

    // Helper functions for localStorage DB
    DB: {
        get(key) {
            return JSON.parse(localStorage.getItem(key)) || [];
        },
        set(key, data) {
            localStorage.setItem(key, JSON.stringify(data));
        },
        getSettings() {
            return JSON.parse(localStorage.getItem('settings')) || {
                prices: { 'Tuna': 150, 'lumayagan': 150, 'Big Karaw': 150, 'Perit': 150, 'Tulingan': 150, 'MC': 150 }
            };
        },
        setSettings(settings) {
            localStorage.setItem('settings', JSON.stringify(settings));
        }
    },

    async init() {
        console.log("FCIRS Initialized with LocalStorage Database");
        
        // Initialize default admin if no users exist
        let users = this.DB.get('users');
        if (users.length === 0) {
            users.push({ username: 'Admin', password: '1234', role: 'ADMIN' });
            this.DB.set('users', users);
        }
    },

    async checkConnection() {
        return true; // Always online since data is local
    },

    async login(username, password) {
        // Fallback for emergency access
        if (username.toLowerCase() === 'admin' && password === '1234') {
            const adminUser = { username: 'Admin', password: '1234', role: 'ADMIN' };
            this.currentUser = adminUser;
            localStorage.setItem('currentUser', JSON.stringify(adminUser));
            this.redirectBasedOnRole('ADMIN');
            return true;
        }

        const users = this.DB.get('users');
        const user = users.find(u => u.username === username && u.password === password);

        if (user) {
            this.currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            this.redirectBasedOnRole(user.role);
            return true;
        }
        return false;
    },

    async register(username, password, role = 'FISHERMAN') {
        const users = this.DB.get('users');
        const exists = users.find(u => u.username === username);

        if (exists) {
            return { success: false, message: 'Username already exists' };
        }

        users.push({ username, password, role: role.toUpperCase() });
        this.DB.set('users', users);
        return { success: true };
    },

    async deleteUser(username) {
        let users = this.DB.get('users');
        users = users.filter(u => u.username !== username);
        this.DB.set('users', users);

        // Cascade delete
        let catches = this.DB.get('catches');
        catches = catches.filter(c => c.fisherman !== username);
        this.DB.set('catches', catches);

        let expenses = this.DB.get('expenses');
        expenses = expenses.filter(e => e.recordedBy !== username);
        this.DB.set('expenses', expenses);

        return { success: true };
    },

    logout() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        window.location.href = 'index.html';
    },

    redirectBasedOnRole(role) {
        if (role === 'Admin' || role === 'ADMIN' || role === 'OPERATOR') {
            window.location.href = 'admin.html';
        } else if (role === 'FISHERMAN') {
            window.location.href = 'fisherman.html';
        }
    },

    async getSettings() {
        return this.DB.getSettings();
    },

    async updateSettings(newPrices) {
        let currentSettings = await this.getSettings();
        let updatedPrices;
        
        if (typeof newPrices === 'object') {
            updatedPrices = { ...currentSettings.prices, ...newPrices };
        } else {
            const price = parseFloat(newPrices);
            updatedPrices = {};
            Object.keys(currentSettings.prices).forEach(key => {
                updatedPrices[key] = price;
            });
        }
        
        currentSettings.prices = updatedPrices;
        this.DB.setSettings(currentSettings);
        return { prices: updatedPrices };
    },

    async getPriceForType(fishType) {
        const settings = await this.getSettings();
        return settings.prices[fishType] || 150; // Default fallback
    },

    async recordCatch(fishType, weight) {
        if (!this.currentUser || this.currentUser.role !== 'FISHERMAN') return;

        const price = await this.getPriceForType(fishType);
        const weightValue = parseFloat(weight);
        const grossValue = weightValue * price;

        const catches = this.DB.get('catches');
        const newCatch = {
            id: Date.now().toString(),
            fisherman: this.currentUser.username,
            fishType: fishType,
            weight: weightValue,
            pricePerKg: price,
            totalValue: grossValue,
            status: 'RECORDED',
            recordedAt: new Date().toISOString()
        };

        catches.push(newCatch);
        this.DB.set('catches', catches);

        return { success: true, id: newCatch.id };
    },

    async getFishermanReports() {
        if (!this.currentUser) return [];
        const catches = this.DB.get('catches');
        return catches.filter(c => c.fisherman === this.currentUser.username);
    },

    async getFishermen() {
        const users = this.DB.get('users');
        return users.filter(u => u.role === 'FISHERMAN');
    },

    async getAllSalesData(filterFisherman = null, filterDate = null) {
        let catches = this.DB.get('catches');

        if (filterFisherman) {
            catches = catches.filter(c => c.fisherman === filterFisherman);
        }
        
        if (filterDate) {
            catches = catches.filter(c => {
                const catchDate = new Date(c.recordedAt).toISOString().split('T')[0];
                return catchDate === filterDate;
            });
        }

        return catches;
    },

    async updateCatch(id, updatedData) {
        let catches = this.DB.get('catches');
        const index = catches.findIndex(c => c.id === id.toString());
        
        if (index !== -1) {
            catches[index] = { ...catches[index], ...updatedData };
            this.DB.set('catches', catches);
            return true;
        }
        return false;
    },

    async deleteCatch(id) {
        let catches = this.DB.get('catches');
        catches = catches.filter(c => c.id !== id.toString());
        this.DB.set('catches', catches);
        return true;
    },

    async manualRecordEntry(fishermanName, fishType, weight, price) {
        const weightValue = parseFloat(weight);
        const priceValue = parseFloat(price || await this.getPriceForType(fishType));
        const grossValue = weightValue * priceValue;

        const catches = this.DB.get('catches');
        catches.push({
            id: Date.now().toString(),
            fisherman: fishermanName,
            fishType: fishType,
            weight: weightValue,
            pricePerKg: priceValue,
            totalValue: grossValue,
            status: 'SOLD',
            recordedAt: new Date().toISOString()
        });

        this.DB.set('catches', catches);
        return { success: true };
    },

    async getSummaryStats(filterFisherman = null, filterDate = null) {
        const catches = await this.getAllSalesData(filterFisherman, filterDate);
        const totalWeight = catches.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0);
        const totalGross = catches.reduce((sum, c) => sum + parseFloat(c.totalValue || 0), 0);

        const marketFee = totalGross * 0.20; // 20% flat market fee from gross
        const sharedData = await this.getSharedExpenseData(filterFisherman, filterDate);

        // Deduct expenses. If viewing everyone, deduct all expenses. If viewing one fisherman, deduct their share
        const sharedDeduction = filterFisherman
            ? parseFloat(sharedData.fishermanShare || 0)
            : parseFloat(sharedData.totalMarketExpenses || 0);

        // Net sales after removing market fee
        const netSales = totalGross - marketFee;
        
        // Split remaining 3 ways BEFORE subtracting bale
        const adminShareTersia = netSales * (2 / 3);
        const fishermanShareGross = netSales / 3;
        
        // Fisherman takes their 1/3, but pays their specific bale/expenses
        const fishermanShareTersia = fishermanShareGross - sharedDeduction;

        // Display revenue: if global view, total revenue = Admin + all fishermen's net
        const totalRevenue = filterFisherman
            ? fishermanShareTersia
            : (netSales - sharedDeduction);

        return {
            totalWeight: totalWeight.toFixed(2),
            totalGross: totalGross.toLocaleString(),
            marketFee: marketFee.toLocaleString(),
            sharedDeduction: sharedDeduction.toLocaleString(),
            netBeforeTersia: netSales.toLocaleString(), // Shows amount before 3-way split
            adminShareTersia: adminShareTersia.toLocaleString(),
            fishermanShareTersia: fishermanShareTersia.toLocaleString(),
            totalRevenue: totalRevenue.toLocaleString(), // Net Income after all deductions
            count: catches.length
        };
    },

    async getOperationalExpenses(filterUser = null, filterDate = null) {
        let expenses = this.DB.get('expenses');

        if (filterUser) {
            expenses = expenses.filter(e => e.recordedBy === filterUser);
        }
        
        if (filterDate) {
            expenses = expenses.filter(e => {
                const exDate = new Date(e.recordedAt).toISOString().split('T')[0];
                return exDate === filterDate;
            });
        }
        
        return expenses;
    },

    async getSharedExpenseData(filterFisherman = null, filterDate = null) {
        const allCatches = await this.getAllSalesData(null, filterDate);
        const allExpenses = await this.getOperationalExpenses(null, filterDate);

        const marketExpenses = allExpenses.filter(e => e.category === 'Market Operation');
        const totalMarketExpenses = marketExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

        const activeFishermen = [...new Set(allCatches.map(c => c.fisherman))];
        const activeCount = activeFishermen.length;

        let fishermanShare = 0;
        
        if (filterFisherman) {
            // For a specific fisherman, "Market Operation" expenses with their name are bales (cash advances)
            const fishermanExpenses = marketExpenses.filter(e => e.description === filterFisherman);
            fishermanShare = fishermanExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        }

        return {
            totalMarketExpenses,
            activeCount,
            fishermanShare: parseFloat(fishermanShare || 0).toFixed(2),
            totalMarketWeight: allCatches.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0),
            expensePerKg: (totalMarketExpenses / (allCatches.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0) || 1)).toFixed(2)
        };
    },

    async addOperationalExpense(description, amount, category = 'General') {
        if (!this.currentUser) return { success: false, message: 'Not logged in' };

        const expenses = this.DB.get('expenses');
        const newExpense = {
            id: Date.now().toString(),
            description,
            amount: parseFloat(amount),
            category,
            recordedBy: this.currentUser.username,
            role: this.currentUser.role,
            recordedAt: new Date().toISOString()
        };

        expenses.push(newExpense);
        this.DB.set('expenses', expenses);

        return { success: true };
    },

    async deleteOperationalExpense(id) {
        let expenses = this.DB.get('expenses');
        expenses = expenses.filter(e => e.id !== id.toString());
        this.DB.set('expenses', expenses);
        return true;
    },

    resetSystem() {
        if(confirm("Are you sure you want to delete ALL data? This cannot be undone.")) {
            localStorage.clear();
            alert("System reset complete!");
            window.location.href = 'index.html';
        }
    }
};

App.init();
