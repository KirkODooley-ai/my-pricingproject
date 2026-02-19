
const API_URL = '/api'; // Relative path, proxied by Vite

export const api = {
    async loadData() {
        try {
            const res = await fetch(`${API_URL}/data`);
            if (!res.ok) throw new Error('Failed to load');
            return await res.json();
        } catch (e) {
            console.error(e);
            return null;
        }
    },

    async save(type, data) {
        try {
            const res = await fetch(`${API_URL}/save/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`Failed to save ${type}`);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async reset() {
        await fetch(`${API_URL}/reset`, { method: 'POST' });
    },

    async saveSetting(key, value) {
        try {
            await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
        } catch (e) {
            console.error(e);
        }
    }
};
