
const API_URL = '/api'; // Relative path, proxied by Vite

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const api = {
    async loadData() {
        try {
            const res = await fetch(`${API_URL}/data`, {
                headers: getHeaders()
            });
            if (res.status === 401 || res.status === 403) return null; // Let App handle redirect
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
                headers: getHeaders(),
                body: JSON.stringify(data)
            });

            // [NEW] Handle Proposal Redirect (Analyst)
            if (res.status === 403) {
                // If 403, check if it's because they need to propose
                // Ideally backend tells us, but for now we catch specific error message or just throw
                const err = await res.json();
                if (err.error === 'Analysts must submit proposals.') {
                    // Auto-submit as proposal? Or let UI handle it?
                    // Let's let UI handle it by throwing specific error
                    throw new Error('PROPOSAL_REQUIRED');
                }
                throw new Error(err.error);
            }

            if (!res.ok) throw new Error(`Failed to save ${type}`);
            return true;
        } catch (e) {
            if (e.message === 'PROPOSAL_REQUIRED') {
                // Determine proposal type map
                // For now only strategy supported
                if (type === 'pricingStrategy') {
                    return await api.submitProposal('pricingStrategy', data);
                }
            }
            console.error(e);
            return false;
        }
    },

    // [NEW] Submit Proposal
    async submitProposal(type, data) {
        try {
            const res = await fetch(`${API_URL}/proposals`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ type, data })
            });
            if (!res.ok) throw new Error('Failed to submit proposal');
            alert("Proposal submitted for Admin approval.");
            return true;
        } catch (e) {
            console.error(e);
            alert("Failed to submit proposal: " + e.message);
            return false;
        }
    },

    // [NEW] Approve Proposal
    async approveProposal(id) {
        try {
            const res = await fetch(`${API_URL}/proposals/${id}/approve`, {
                method: 'POST',
                headers: getHeaders()
            });
            if (!res.ok) throw new Error('Failed to approve');
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    async reset() {
        await fetch(`${API_URL}/reset`, {
            method: 'POST',
            headers: getHeaders()
        });
    },

    async saveSetting(key, value) {
        try {
            await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ key, value })
            });
        } catch (e) {
            console.error(e);
        }
    }
};
