/**
 * FCIRS System - Core Logic with MySQL/Node.js Integration
 */

// Use localhost API if running directly from file, otherwise use relative path
const API_BASE_URL = window.location.protocol === 'file:' 
    ? 'http://localhost:3000/api' 
    : '/api';

const App = {
    // Current User Session
    currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,

    async init() {
        console.log("FCIRS Initialized with MySQL Backend");
        const status = await this.checkConnection();
        if (!status) {
            console.warn("Backend server not detected at http://localhost:3000");
        }
    },

    async checkConnection() {
        try {
            const response = await fetch(`${API_BASE_URL}/settings`, { signal: AbortSignal.timeout(2000) });
            return response.ok;
        } catch (e) {
            return false;
        }
    },

    async login(username, password) {
        // Fallback for emergency access
        if (username.toLowerCase() === 'admin' && password === '1234') {
            const adminUser = { username: 'Admin', password: '1234', role: 'Admin' };
            this.currentUser = adminUser;
            localStorage.setItem('currentUser', JSON.stringify(adminUser));
            this.redirectBasedOnRole('Admin');
            return true;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                this.redirectBasedOnRole(data.user.role);
                return true;
            }
        } catch (error) {
            console.error("Login error:", error);
        }
        return false;
    },

    async register(username, password, role = 'FISHERMAN') {
        try {
            const response = await fetch(`${API_BASE_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });
            if (response.ok) return { success: true };
            const data = await response.json();
            return { success: false, message: data.message || 'Registration failed' };
        } catch (error) {
            return { success: false, message: 'Server connection failed' };
        }
    },

    async deleteUser(username) {
        try {
            await fetch(`${API_BASE_URL}/users/${username}`, { method: 'DELETE' });
            return { success: true };
        } catch (error) {
            return { success: false };
        }
    },

    logout() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        window.location.href = 'index.html';
    },

    redirectBasedOnRole(role) {
        if (role === 'Admin' || role === 'ADMIN') {
            window.location.href = 'admin.html';
        } else if (role === 'FISHERMAN') {
            window.location.href = 'fisherman.html';
        }
    },

    async getSettings() {
        try {
            const response = await fetch(`${API_BASE_URL}/settings`);
            const data = await response.json();
            return data;
        } catch (error) {
            return { prices: { 'Tuna': 150, 'lumayagan': 150, 'Big Karaw': 150, 'Perit': 150, 'Tulingan': 150, 'MC': 150 } };
        }
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
        
        try {
            await fetch(`${API_BASE_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prices: updatedPrices })
            });
        } catch (error) {
            console.error("Update settings error:", error);
        }
        return { prices: updatedPrices };
    },

    async getPriceForType(fishType) {
        const settings = await this.getSettings();
        return settings.prices[fishType] || 150;
    },

    async recordCatch(fishType, weight) {
        if (!this.currentUser || this.currentUser.role !== 'FISHERMAN') return;

        const price = await this.getPriceForType(fishType);
        const weightValue = parseFloat(weight);
        const grossValue = weightValue * price;

        try {
            const response = await fetch(`${API_BASE_URL}/catches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fisherman: this.currentUser.username,
                    fish_type: fishType,
                    weight: weightValue,
                    price_per_kg: price,
                    total_value: grossValue,
                    status: 'RECORDED'
                })
            });
            return await response.json();
        } catch (error) {
            console.error(error);
        }
    },

    async getFishermanReports() {
        if (!this.currentUser) return [];
        try {
            const response = await fetch(`${API_BASE_URL}/catches?fisherman=${this.currentUser.username}`);
            const data = await response.json();
            return data.map(r => ({
                id: r.id, fisherman: r.fisherman, fishType: r.fish_type, 
                weight: r.weight, pricePerKg: r.price_per_kg, totalValue: r.total_value, 
                recordedAt: r.recorded_at, status: r.status 
            }));
        } catch (error) {
            return [];
        }
    },

    async getFishermen() {
        try {
            const response = await fetch(`${API_BASE_URL}/users`);
            const data = await response.json();
            return data.filter(u => u.role === 'FISHERMAN');
        } catch (error) {
            return [];
        }
    },

    async getAllSalesData(filterFisherman = null, filterDate = null) {
        let url = `${API_BASE_URL}/catches?`;
        if (filterFisherman) url += `fisherman=${filterFisherman}&`;
        if (filterDate) url += `date=${filterDate}&`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.map(r => ({
                id: r.id, fisherman: r.fisherman, fishType: r.fish_type, 
                weight: r.weight, pricePerKg: r.price_per_kg, totalValue: r.total_value, 
                recordedAt: r.recorded_at, status: r.status 
            }));
        } catch (error) {
            return [];
        }
    },

    async updateCatch(id, updatedData) {
        try {
            const response = await fetch(`${API_BASE_URL}/catches/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    async deleteCatch(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/catches/${id}`, { method: 'DELETE' });
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    async manualRecordEntry(fishermanName, fishType, weight, price) {
        const weightValue = parseFloat(weight);
        const priceValue = parseFloat(price || await this.getPriceForType(fishType));
        const grossValue = weightValue * priceValue;

        try {
            const response = await fetch(`${API_BASE_URL}/catches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fisherman: fishermanName,
                    fish_type: fishType,
                    weight: weightValue,
                    price_per_kg: priceValue,
                    total_value: grossValue,
                    status: 'SOLD'
                })
            });
            if (response.ok) return { success: true };
        } catch (error) {
            return { success: false, message: 'Server error' };
        }
    },

    async getSummaryStats(filterFisherman = null, filterDate = null) {
        const catches = await this.getAllSalesData(filterFisherman, filterDate);
        const totalWeight = catches.reduce((sum, c) => sum + parseFloat(c.weight || 0), 0);
        const totalGross = catches.reduce((sum, c) => sum + parseFloat(c.totalValue || 0), 0);

        const marketFee = totalGross * 0.20;
        const sharedData = await this.getSharedExpenseData(filterFisherman, filterDate);

        const sharedDeduction = filterFisherman
            ? parseFloat(sharedData.fishermanShare || 0)
            : parseFloat(sharedData.totalMarketExpenses || 0);

        const netSales = totalGross - marketFee;
        const adminShareTersia = netSales * (2 / 3);
        const fishermanShareGross = netSales / 3;
        const fishermanShareTersia = fishermanShareGross - sharedDeduction;

        const totalRevenue = filterFisherman
            ? fishermanShareTersia
            : (netSales - sharedDeduction);

        return {
            totalWeight: totalWeight.toFixed(2),
            totalGross: totalGross.toLocaleString(),
            marketFee: marketFee.toLocaleString(),
            sharedDeduction: sharedDeduction.toLocaleString(),
            netBeforeTersia: netSales.toLocaleString(),
            adminShareTersia: adminShareTersia.toLocaleString(),
            fishermanShareTersia: fishermanShareTersia.toLocaleString(),
            totalRevenue: totalRevenue.toLocaleString(),
            count: catches.length
        };
    },

    async getOperationalExpenses(filterUser = null, filterDate = null) {
        let url = `${API_BASE_URL}/expenses?`;
        if (filterUser) url += `recorded_by=${filterUser}&`;
        if (filterDate) url += `date=${filterDate}&`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            return data.map(e => ({
                id: e.id, description: e.description, amount: e.amount, 
                category: e.category, recordedBy: e.recorded_by, 
                role: e.role, recordedAt: e.recorded_at
            }));
        } catch (error) {
            return [];
        }
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
            fishermanShare = marketExpenses
                .filter(e => e.description === filterFisherman)
                .reduce((sum, e) => sum + parseFloat(e.amount), 0);
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

        try {
            const response = await fetch(`${API_BASE_URL}/expenses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description,
                    amount: parseFloat(amount),
                    category,
                    recorded_by: this.currentUser.username,
                    role: this.currentUser.role
                })
            });
            if (response.ok) return { success: true };
        } catch (error) {
            return { success: false };
        }
    },

    async deleteOperationalExpense(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/expenses/${id}`, { method: 'DELETE' });
            return response.ok;
        } catch (error) {
            return false;
        }
    },

    resetSystem() {
        alert("System reset is disabled in MySQL mode.");
    }
};

App.init();
