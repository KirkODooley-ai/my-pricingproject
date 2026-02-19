import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const ProposalsManager = () => {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadProposals = async () => {
        setLoading(true);
        const data = await api.loadData(); // api.loadData now fetches proposals for admins
        if (data && data.proposals) {
            setProposals(data.proposals);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadProposals();
    }, []);

    const handleApprove = async (id) => {
        if (window.confirm("Are you sure you want to approve this change?")) {
            const success = await api.approveProposal(id);
            if (success) {
                alert("Approved!");
                loadProposals(); // Reload to refresh list and data
            } else {
                alert("Failed to approve.");
            }
        }
    };

    if (loading) return <div>Loading Proposals...</div>;

    return (
        <div style={{ padding: '2rem' }}>
            <h2 className="heading-lg">Pending Proposals</h2>
            {proposals.length === 0 ? (
                <p>No pending proposals.</p>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {proposals.map(p => (
                        <div key={p.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontWeight: 'bold' }}>{p.type} Change</h3>
                                    <p className="text-sm" style={{ color: '#6b7280' }}>
                                        Submitted by <strong>{p.username}</strong> on {new Date(p.created_at).toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleApprove(p.id)}
                                >
                                    Approve
                                </button>
                            </div>
                            <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
                                <pre style={{ fontSize: '0.8rem', overflowX: 'auto' }}>
                                    {JSON.stringify(p.data, null, 2)}
                                </pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProposalsManager;
