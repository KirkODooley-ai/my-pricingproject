import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MARGIN_GAUGE_SPECIFIC_CATEGORIES } from '../utils/pricingEngine';

const AdminSettings = ({ globalSettings, onUpdateSetting, marginRules = [], onSaveMarginRules, products = [], productVariants = [], categories = [] }) => {
    const { user } = useAuth();
    const canEdit = user?.role === 'admin' || user?.can_edit === true;
    const [guardrailDraft, setGuardrailDraft] = useState({});

    // Dynamic: all unique categories from products table + categories table
    const allCategories = useMemo(() => {
        const fromProducts = (products || []).map(p => (p.category || '').trim()).filter(Boolean);
        const fromCats = (categories || []).map(c => (c.name || '').trim()).filter(Boolean);
        return [...new Set([...fromProducts, ...fromCats])].sort((a, b) => a.localeCompare(b));
    }, [products, categories]);

    // Categories that actually use gauges (have products with variants that have gauge)
    const gaugesPerCategory = useMemo(() => {
        const map = {};
        (productVariants || []).forEach(v => {
            if (v.gauge == null) return;
            const product = (products || []).find(p => p.id === v.productId);
            const catName = (product?.category || '').trim() || (product?.categoryId && (categories || []).find(c => c.id === product.categoryId))?.name;
            if (!catName) return;
            if (!map[catName]) map[catName] = new Set();
            map[catName].add(parseInt(v.gauge, 10));
        });
        Object.keys(map).forEach(k => {
            map[k] = Array.from(map[k]).sort((a, b) => a - b);
        });
        return map;
    }, [products, productVariants, categories]);

    const gaugeSpecificCategories = useMemo(() =>
        [...MARGIN_GAUGE_SPECIFIC_CATEGORIES].sort((a, b) => a.localeCompare(b)),
        []
    );

    const gaugesForGaugeSpecific = useMemo(() => {
        const map = {};
        gaugeSpecificCategories.forEach(cat => {
            const gauges = gaugesPerCategory[cat];
            map[cat] = gauges?.length ? gauges : [24, 26, 29];
        });
        return map;
    }, [gaugesPerCategory, gaugeSpecificCategories]);

    const generalCategories = useMemo(() => {
        const gaugeSet = new Set(MARGIN_GAUGE_SPECIFIC_CATEGORIES);
        return allCategories.filter(c => !gaugeSet.has(c)).sort((a, b) => a.localeCompare(b));
    }, [allCategories]);

    useEffect(() => {
        const map = {};
        (marginRules || []).forEach(r => {
            const key = `${r.targetName || r.target_name}|${r.gauge == null ? 'blanket' : r.gauge}`;
            map[key] = {
                marginFloor: r.marginFloor ?? r.margin_floor ?? '',
                marginCeiling: r.marginCeiling ?? r.margin_ceiling ?? ''
            };
        });
        setGuardrailDraft(map);
    }, [marginRules]);
    // Premium SaaS UI Variables
    const getRule = (targetName, gauge) => {
        const key = `${targetName}|${gauge ?? 'blanket'}`;
        return guardrailDraft[key] || { marginFloor: '', marginCeiling: '' };
    };
    const setRule = (targetName, gauge, field, value) => {
        const key = `${targetName}|${gauge ?? 'blanket'}`;
        setGuardrailDraft(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: value } }));
    };
    const handleSaveGuardrails = async () => {
        const rules = [];
        // Gauge-specific rules: FA, FC36, I9, II6, FR, 12" Forma Loc, 16" Forma Loc
        gaugeSpecificCategories.forEach(target => {
            (gaugesForGaugeSpecific[target] || []).forEach(g => {
                const r = getRule(target, g);
                const floor = r.marginFloor !== '' && r.marginFloor != null ? r.marginFloor : null;
                const ceiling = r.marginCeiling !== '' && r.marginCeiling != null ? r.marginCeiling : null;
                if (floor != null || ceiling != null) {
                    rules.push({ targetName: target, gauge: g, marginFloor: floor ?? 0.2, marginCeiling: ceiling });
                }
            });
        });
        // General category rules (Floor/Ceiling only, no gauge)
        generalCategories.forEach(target => {
            const r = getRule(target, null);
            const floor = r.marginFloor !== '' && r.marginFloor != null ? r.marginFloor : null;
            const ceiling = r.marginCeiling !== '' && r.marginCeiling != null ? r.marginCeiling : null;
            if (floor != null || ceiling != null) {
                rules.push({ targetName: target, gauge: null, marginFloor: floor ?? 0.2, marginCeiling: ceiling });
            }
        });
        try {
            await onSaveMarginRules(rules);
            alert('Margin guardrails saved.');
        } catch (e) {
            alert('Failed to save: ' + e.message);
        }
    };

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

                {/* Margin Guardrails */}
                <div style={{...styles.card, borderTop: '4px solid #059669', marginTop: '2rem'}}>
                    <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.25rem 0' }}>Margin Guardrails</h3>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>Set floor and ceiling by Product Line and Gauge</p>
                        </div>
                    </div>

                    {/* Gauge-Specific Rules (top priority) */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gauge-Specific Rules</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                            {gaugeSpecificCategories.map(target => (
                                <div key={target} style={{ padding: '1rem', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#92400e', marginBottom: '0.75rem' }}>{target}</div>
                                    {(gaugesForGaugeSpecific[target] || []).map(g => (
                                        <div key={`${target}-${g}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span style={{ width: '28px', fontSize: '0.85rem', fontWeight: '600', color: '#64748b' }}>{g}ga</span>
                                            <input
                                                type="number"
                                                step="0.001"
                                                placeholder="0.20"
                                                value={getRule(target, g).marginFloor}
                                                onChange={e => setRule(target, g, 'marginFloor', e.target.value)}
                                                disabled={!canEdit}
                                                style={{...styles.inputField, width: '65px', fontSize: '0.85rem'}}
                                            />
                                            <input
                                                type="number"
                                                step="0.001"
                                                placeholder="—"
                                                value={getRule(target, g).marginCeiling}
                                                onChange={e => setRule(target, g, 'marginCeiling', e.target.value)}
                                                disabled={!canEdit}
                                                style={{...styles.inputField, width: '65px', fontSize: '0.85rem'}}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* General Category Rules */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>General Category Rules</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                            {generalCategories.length === 0 ? (
                                <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.9rem' }}>No general categories found.</div>
                            ) : generalCategories.map(target => (
                                <div key={target} style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>{target}</div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Floor</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                max="1"
                                                placeholder="0.20"
                                                value={getRule(target, null).marginFloor}
                                                onChange={e => setRule(target, null, 'marginFloor', e.target.value)}
                                                disabled={!canEdit}
                                                style={{...styles.inputField, width: '70px', fontSize: '0.9rem', marginLeft: '4px'}}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Ceiling</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                min="0"
                                                max="1"
                                                placeholder="—"
                                                value={getRule(target, null).marginCeiling}
                                                onChange={e => setRule(target, null, 'marginCeiling', e.target.value)}
                                                disabled={!canEdit}
                                                style={{...styles.inputField, width: '70px', fontSize: '0.9rem', marginLeft: '4px'}}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {canEdit && (
                        <button
                            onClick={handleSaveGuardrails}
                            style={{ padding: '0.6rem 1.25rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                        >
                            Save Margin Guardrails
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
