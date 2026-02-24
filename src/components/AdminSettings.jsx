import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminSettings = ({ globalSettings, onUpdateSetting }) => {
    const { user } = useAuth();
    const canEdit = user?.role === 'admin' || user?.can_edit === true;
    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1000px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' },
        headerText: { fontSize: '1.85rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' },
        subText: { color: '#64748b', fontSize: '1.05rem', margin: 0 },
        
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', padding: '2.5rem', marginBottom: '2rem' },
        
        inputField: { padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1.1rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', fontWeight: '700', width: '140px', textAlign: 'center' },
        label: { display: 'block', marginBottom: '1rem', fontWeight: '600', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>
                            <span style={{ fontSize: '1.6rem', color: '#475569' }}>⚙️</span> System Settings
                        </h2>
                        <p style={styles.subText}>Configure global system preferences and root pricing parameters.</p>
                    </div>
                </div>

                <div style={{...styles.card, borderTop: '4px solid #3b82f6'}}>
                    <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.25rem 0', letterSpacing: '-0.01em' }}>Global Pricing Configuration</h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Master controls for the pricing matrix</p>
                        </div>
                    </div>

                    <div>
                        <label style={styles.label}>
                            Base Markup Multiplier (System Default)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', backgroundColor: '#f8fafc', padding: '2rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1.0"
                                    value={globalSettings.global_multiplier || 1.5}
                                    onChange={(e) => onUpdateSetting('global_multiplier', parseFloat(e.target.value))}
                                    style={styles.inputField}
                                    disabled={!canEdit}
                                />
                                <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#94a3b8' }}>x</span>
                            </div>
                            
                            <div style={{ height: '50px', width: '2px', backgroundColor: '#e2e8f0' }}></div>
                            
                            <div>
                                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formula Preview</span>
                                <div style={{ fontSize: '1.1rem', color: '#334155', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: '#0f172a', fontWeight: '600' }}>Base List Price</span> 
                                    <span style={{ color: '#94a3b8' }}>=</span> 
                                    <span style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '600', color: '#2563eb' }}>Cost</span> 
                                    <span style={{ color: '#94a3b8' }}>×</span> 
                                    <span style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700', color: '#059669' }}>{globalSettings.global_multiplier || 1.5}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ 
                            marginTop: '1.5rem', 
                            padding: '1.25rem 1.5rem', 
                            backgroundColor: '#fffbeb', 
                            border: '1px solid #fde68a', 
                            borderRadius: '10px',
                            display: 'flex',
                            gap: '1.25rem',
                            alignItems: 'flex-start'
                        }}>
                            <span style={{ fontSize: '1.5rem', color: '#d97706', lineHeight: '1' }}>⚠️</span>
                            <div>
                                <strong style={{ display: 'block', color: '#92400e', fontSize: '0.95rem', marginBottom: '0.35rem' }}>Critical System Impact</strong>
                                <span style={{ color: '#b45309', fontSize: '0.9rem', lineHeight: '1.5', display: 'block' }}>
                                    Modifying this value will immediately recalculate the Base List Price for <strong style={{color: '#92400e'}}>all products</strong> currently utilizing the "Default" multiplier across the entire pricing matrix. Ensure changes are communicated to the sales team.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
